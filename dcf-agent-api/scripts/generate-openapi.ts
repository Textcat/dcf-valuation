import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stringify } from 'yaml'
import app from '../src/index'

const doc = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
        title: 'DCF Agent API',
        version: '1.0.0',
        description: 'Aggregated DCF valuation API for AI agents'
    }
})

const jsonPath = resolve(process.cwd(), 'openapi/openapi.json')
const yamlPath = resolve(process.cwd(), 'openapi/openapi.yaml')

writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf-8')
writeFileSync(yamlPath, stringify(doc), 'utf-8')

console.log(`Generated ${jsonPath}`)
console.log(`Generated ${yamlPath}`)
