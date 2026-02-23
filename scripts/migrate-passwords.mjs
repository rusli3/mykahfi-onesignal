import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;
const BCRYPT_ROUNDS = 12;

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        batchSize: DEFAULT_BATCH_SIZE,
        limit: DEFAULT_LIMIT,
    };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }
        if (arg === "--batch-size") {
            options.batchSize = Number(args[i + 1] || DEFAULT_BATCH_SIZE);
            i += 1;
            continue;
        }
        if (arg === "--limit") {
            options.limit = Number(args[i + 1] || DEFAULT_LIMIT);
            i += 1;
            continue;
        }
    }

    if (!Number.isFinite(options.batchSize) || options.batchSize <= 0) {
        throw new Error("Invalid --batch-size value");
    }
    if (!Number.isFinite(options.limit) || options.limit <= 0) {
        throw new Error("Invalid --limit value");
    }

    return options;
}

function isBcryptHash(value) {
    return BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function getSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function main() {
    loadEnvConfig(process.cwd());

    const { dryRun, batchSize, limit } = parseArgs();
    const supabase = getSupabase();

    let offset = 0;
    let scanned = 0;
    let alreadyHashed = 0;
    let candidates = 0;
    let migrated = 0;
    let failures = 0;

    console.log(
        `[password-migration] Start dryRun=${dryRun} batchSize=${batchSize} limit=${limit}`
    );

    while (migrated < limit) {
        const to = offset + batchSize - 1;
        const { data: users, error } = await supabase
            .from("users")
            .select("nis, password")
            .order("nis", { ascending: true })
            .range(offset, to);

        if (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }

        if (!users || users.length === 0) {
            break;
        }

        for (const user of users) {
            scanned += 1;
            const password = String(user.password || "");
            if (!password) {
                continue;
            }

            if (isBcryptHash(password)) {
                alreadyHashed += 1;
                continue;
            }

            candidates += 1;
            if (migrated >= limit) {
                continue;
            }

            if (dryRun) {
                migrated += 1;
                continue;
            }

            try {
                const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
                const { error: updateError } = await supabase
                    .from("users")
                    .update({ password: hashedPassword })
                    .eq("nis", user.nis);

                if (updateError) {
                    failures += 1;
                    console.error(
                        `[password-migration] Failed update for NIS=${user.nis}: ${updateError.message}`
                    );
                    continue;
                }

                migrated += 1;
            } catch (err) {
                failures += 1;
                console.error(
                    `[password-migration] Failed hash/update for NIS=${user.nis}: ${
                        err instanceof Error ? err.message : "unknown error"
                    }`
                );
            }
        }

        offset += users.length;
    }

    console.log("[password-migration] Summary");
    console.log(`- scanned: ${scanned}`);
    console.log(`- already_hashed: ${alreadyHashed}`);
    console.log(`- plaintext_candidates: ${candidates}`);
    console.log(`- migrated_or_would_migrate: ${migrated}`);
    console.log(`- failures: ${failures}`);

    if (failures > 0) {
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(
        `[password-migration] Fatal error: ${
            err instanceof Error ? err.message : "unknown error"
        }`
    );
    process.exitCode = 1;
});
