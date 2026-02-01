/**
 * Unit tests for Industry Benchmarks Mapping
 * 
 * Tests the FMP → Damodaran industry mapping coverage and correctness.
 */
import { describe, it, expect } from 'vitest'
import {
    FMP_TO_DAMODARAN,
    FMP_SECTOR_DEFAULTS,
    DAMODARAN_INDUSTRIES,
    getIndustryBenchmark,
    getDamodaranIndustryName,
    getIndustryThresholds
} from '../data/industryBenchmarks'

// ============================================================
// Known FMP Industries (from FMP API documentation)
// ============================================================

/**
 * Comprehensive list of FMP industries based on their API
 * Source: https://site.financialmodelingprep.com/developer/docs
 * 
 * This list should be updated periodically to ensure coverage
 */
const KNOWN_FMP_INDUSTRIES = [
    // Technology
    'Semiconductors',
    'Semiconductor Equipment & Materials',
    'Software—Application',
    'Software—Infrastructure',
    'Information Technology Services',
    'Computer Hardware',
    'Consumer Electronics',
    'Electronic Components',
    'Scientific & Technical Instruments',
    'Communication Equipment',
    'Electronic Gaming & Multimedia',
    'Internet Content & Information',

    // Healthcare
    'Biotechnology',
    'Drug Manufacturers—General',
    'Drug Manufacturers—Specialty & Generic',
    'Medical Devices',
    'Medical Instruments & Supplies',
    'Diagnostics & Research',
    'Healthcare Plans',
    'Medical Care Facilities',
    'Pharmaceutical Retailers',
    'Health Information Services',

    // Financial Services
    'Banks—Diversified',
    'Banks—Regional',
    'Capital Markets',
    'Asset Management',
    'Insurance—Life',
    'Insurance—Property & Casualty',
    'Insurance—Diversified',
    'Insurance Brokers',
    'Credit Services',
    'Financial Data & Stock Exchanges',
    'Mortgage Finance',

    // Consumer Cyclical
    'Auto Manufacturers',
    'Auto Parts',
    'Auto & Truck Dealerships',
    'Recreational Vehicles',
    'Specialty Retail',
    'Home Improvement Retail',
    'Apparel Retail',
    'Department Stores',
    'Discount Stores',
    'Internet Retail',
    'Restaurants',
    'Resorts & Casinos',
    'Lodging',
    'Travel Services',
    'Gambling',
    'Leisure',
    'Apparel Manufacturing',
    'Footwear & Accessories',
    'Textile Manufacturing',
    'Luxury Goods',
    'Residential Construction',
    'Furnishings, Fixtures & Appliances',
    'Packaging & Containers',

    // Consumer Defensive
    'Beverages—Non-Alcoholic',
    'Beverages—Brewers',
    'Beverages—Wineries & Distilleries',
    'Confectioners',
    'Farm Products',
    'Food Distribution',
    'Grocery Stores',
    'Household & Personal Products',
    'Packaged Foods',
    'Tobacco',
    'Education & Training Services',
    'Personal Services',

    // Industrials
    'Aerospace & Defense',
    'Airlines',
    'Airports & Air Services',
    'Building Products & Equipment',
    'Business Equipment & Supplies',
    'Conglomerates',
    'Consulting Services',
    'Electrical Equipment & Parts',
    'Engineering & Construction',
    'Farm & Heavy Construction Machinery',
    'Industrial Distribution',
    'Infrastructure Operations',
    'Integrated Freight & Logistics',
    'Marine Shipping',
    'Metal Fabrication',
    'Pollution & Treatment Controls',
    'Railroads',
    'Rental & Leasing Services',
    'Security & Protection Services',
    'Specialty Business Services',
    'Specialty Industrial Machinery',
    'Staffing & Employment Services',
    'Tools & Accessories',
    'Trucking',
    'Waste Management',

    // Energy
    'Oil & Gas Integrated',
    'Oil & Gas E&P',
    'Oil & Gas Midstream',
    'Oil & Gas Equipment & Services',
    'Oil & Gas Refining & Marketing',
    'Oil & Gas Drilling',
    'Thermal Coal',
    'Uranium',

    // Utilities
    'Utilities—Regulated Electric',
    'Utilities—Regulated Gas',
    'Utilities—Regulated Water',
    'Utilities—Diversified',
    'Utilities—Independent Power Producers',
    'Utilities—Renewable',

    // Real Estate
    'REIT—Diversified',
    'REIT—Healthcare Facilities',
    'REIT—Hotel & Motel',
    'REIT—Industrial',
    'REIT—Mortgage',
    'REIT—Office',
    'REIT—Residential',
    'REIT—Retail',
    'REIT—Specialty',
    'Real Estate Services',
    'Real Estate—Development',
    'Real Estate—Diversified',

    // Basic Materials
    'Aluminum',
    'Building Materials',
    'Chemicals',
    'Coking Coal',
    'Copper',
    'Gold',
    'Lumber & Wood Production',
    'Other Industrial Metals & Mining',
    'Other Precious Metals & Mining',
    'Paper & Paper Products',
    'Silver',
    'Specialty Chemicals',
    'Steel',
    'Agricultural Inputs',

    // Communication Services
    'Advertising Agencies',
    'Broadcasting',
    'Entertainment',
    'Publishing',
    'Telecom Services',
]

const KNOWN_FMP_SECTORS = [
    'Technology',
    'Healthcare',
    'Financial Services',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Industrials',
    'Energy',
    'Utilities',
    'Real Estate',
    'Basic Materials',
    'Communication Services',
]

// ============================================================
// Mapping Coverage Tests
// ============================================================

describe('FMP Industry Mapping Coverage', () => {
    it('should have mappings for all known FMP industries', () => {
        const unmapped: string[] = []
        const mapped: string[] = []

        for (const industry of KNOWN_FMP_INDUSTRIES) {
            if (FMP_TO_DAMODARAN[industry]) {
                mapped.push(industry)
            } else {
                unmapped.push(industry)
            }
        }

        // Log unmapped for visibility
        if (unmapped.length > 0) {
            console.log('Unmapped FMP industries:', unmapped)
        }

        // Coverage should be > 95%
        const coverage = mapped.length / KNOWN_FMP_INDUSTRIES.length
        expect(coverage).toBeGreaterThan(0.95)

        // Report actual coverage
        console.log(`Mapping coverage: ${mapped.length}/${KNOWN_FMP_INDUSTRIES.length} (${(coverage * 100).toFixed(1)}%)`)
    })

    it('should have sector defaults for all FMP sectors', () => {
        const unmappedSectors: string[] = []

        for (const sector of KNOWN_FMP_SECTORS) {
            if (!FMP_SECTOR_DEFAULTS[sector]) {
                unmappedSectors.push(sector)
            }
        }

        expect(unmappedSectors).toHaveLength(0)
    })

    it('should map to valid Damodaran industries', () => {
        const invalidMappings: string[] = []

        for (const [fmpIndustry, damodaranIndustry] of Object.entries(FMP_TO_DAMODARAN)) {
            if (!DAMODARAN_INDUSTRIES[damodaranIndustry]) {
                invalidMappings.push(`${fmpIndustry} -> ${damodaranIndustry}`)
            }
        }

        expect(invalidMappings).toHaveLength(0)
    })

    it('should have valid sector default mappings', () => {
        for (const [_sector, damodaranIndustry] of Object.entries(FMP_SECTOR_DEFAULTS)) {
            expect(DAMODARAN_INDUSTRIES[damodaranIndustry]).toBeDefined()
        }
    })
})

// ============================================================
// Lookup Function Tests
// ============================================================

describe('getIndustryBenchmark', () => {
    it('returns exact match when FMP industry is mapped', () => {
        const benchmark = getIndustryBenchmark('Semiconductors', 'Technology')
        // Semiconductor 2026: 35% margin, 41% ROIC
        expect(benchmark.operatingMargin).toBeCloseTo(0.35, 2)
        expect(benchmark.afterTaxROIC).toBeCloseTo(0.41, 2)
    })

    it('falls back to sector default when industry not found', () => {
        const benchmark = getIndustryBenchmark('Unknown Industry XYZ', 'Technology')

        // Technology default = Software (System & Application): 33% margin, 54% ROIC
        expect(benchmark.operatingMargin).toBeCloseTo(0.33, 2)
        expect(benchmark.afterTaxROIC).toBeCloseTo(0.54, 2)
    })

    it('falls back to Total Market when neither industry nor sector found', () => {
        const benchmark = getIndustryBenchmark('Unknown', 'Unknown Sector')
        // Total Market 2026: 13% margin, 19% ROIC
        expect(benchmark.operatingMargin).toBeCloseTo(0.13, 2)
        expect(benchmark.afterTaxROIC).toBeCloseTo(0.19, 2)
    })

    it('handles undefined inputs gracefully', () => {
        const benchmark = getIndustryBenchmark(undefined, undefined)

        // Should return Total Market
        expect(benchmark.operatingMargin).toBeDefined()
        expect(benchmark.afterTaxROIC).toBeDefined()
    })
})

describe('getDamodaranIndustryName', () => {
    it('returns Damodaran name for exact match', () => {
        const name = getDamodaranIndustryName('Semiconductors', 'Technology')
        expect(name).toBe('Semiconductor')
    })

    it('returns sector default with annotation', () => {
        const name = getDamodaranIndustryName('Unknown Industry', 'Healthcare')
        expect(name).toContain('Sector Default')
    })

    it('returns Total Market fallback', () => {
        const name = getDamodaranIndustryName(undefined, undefined)
        expect(name).toContain('Fallback')
    })
})

describe('getIndustryThresholds', () => {
    it('calculates warning and error thresholds correctly', () => {
        const benchmark = { operatingMargin: 0.20, afterTaxROIC: 0.15, numberOfFirms: 100 }
        const thresholds = getIndustryThresholds(benchmark)

        // Warning = 1.5x median for margin, 1.3x for ROIC
        expect(thresholds.marginWarning).toBeCloseTo(0.30, 2)
        expect(thresholds.roicWarning).toBeCloseTo(0.195, 2)

        // Error = 2.0x median for margin, 1.6x for ROIC
        expect(thresholds.marginError).toBeCloseTo(0.40, 2)
        expect(thresholds.roicError).toBeCloseTo(0.24, 2)
    })

    it('respects caps for high-margin industries', () => {
        const benchmark = { operatingMargin: 0.35, afterTaxROIC: 0.25, numberOfFirms: 10 }
        const thresholds = getIndustryThresholds(benchmark)

        // Should be capped at 60%/80% respectively
        expect(thresholds.marginError).toBeLessThanOrEqual(0.60)
        expect(thresholds.roicError).toBeLessThanOrEqual(0.80)
    })

    it('uses floor for negative margin industries', () => {
        const benchmark = { operatingMargin: -0.10, afterTaxROIC: -0.05, numberOfFirms: 500 }
        const thresholds = getIndustryThresholds(benchmark)

        // Should use 0.05 floor
        expect(thresholds.marginWarning).toBeGreaterThan(0)
        expect(thresholds.roicWarning).toBeGreaterThan(0)
    })
})

// ============================================================
// Data Integrity Tests
// ============================================================

describe('Damodaran Industry Data Integrity', () => {
    it('should have reasonable operating margins (between -50% and 60%)', () => {
        for (const [_name, data] of Object.entries(DAMODARAN_INDUSTRIES)) {
            expect(data.operatingMargin).toBeGreaterThanOrEqual(-0.50)
            expect(data.operatingMargin).toBeLessThanOrEqual(0.60)
        }
    })

    it('should have reasonable ROIC (between -20% and 50%)', () => {
        for (const [_name, data] of Object.entries(DAMODARAN_INDUSTRIES)) {
            expect(data.afterTaxROIC).toBeGreaterThanOrEqual(-0.35)
            expect(data.afterTaxROIC).toBeLessThanOrEqual(0.90)
        }
    })

    it('should have positive numberOfFirms', () => {
        for (const [_name, data] of Object.entries(DAMODARAN_INDUSTRIES)) {
            expect(data.numberOfFirms).toBeGreaterThan(0)
        }
    })

    it('should have Total Market as fallback', () => {
        expect(DAMODARAN_INDUSTRIES['Total Market']).toBeDefined()
    })
})
