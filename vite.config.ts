import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
});
