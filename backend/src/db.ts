import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config()

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("FATAL ERROR: DATABASE_URL belum diatur di file .env");
}

// Di Vercel (serverless) satu instance hanya melayani satu request, jadi 1 koneksi cukup
// dan mencegah error "too many clients". Di lokal/tes, beberapa koneksi supaya request paralel benar-benar paralel.
const pool = new Pool({
    connectionString,
    max: process.env.VERCEL === '1' ? 1 : 10
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter })