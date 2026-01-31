import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        cache: {
            dir: './node_modules/.vitest'
        }
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname
        }
    }
})
