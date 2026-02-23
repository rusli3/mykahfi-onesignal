import bcrypt from "bcryptjs";

const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];
const BCRYPT_ROUNDS = 12;

export function isBcryptHash(value: string): boolean {
    return BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
    plainPassword: string,
    storedPassword: string
): Promise<boolean> {
    if (isBcryptHash(storedPassword)) {
        return bcrypt.compare(plainPassword, storedPassword);
    }

    // Backward compatibility during migration from plaintext passwords.
    return storedPassword === plainPassword;
}
