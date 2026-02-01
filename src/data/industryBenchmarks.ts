/**
 * Industry Benchmarks Data
 * 
 * Source: Damodaran Online (NYU Stern)
 * - Operating Margin: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/margin.html
 * - ROIC (Unadjusted After-tax): https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/roc.htm
 * 
 * Data as of January 2026 (extracted from official XLS files)
 * 
 * Note: Uses "Pre-tax Unadjusted Operating Margin" and "Unadjusted after-tax ROIC"
 * to align with our calculation: ROIC = EBIT × (1 - t) / (Equity + Debt - Cash)
 */

// ============================================================
// Damodaran Industry Data
// ============================================================

export interface IndustryBenchmark {
    operatingMargin: number      // Pre-tax Unadjusted Operating Margin (EBIT/Revenue)
    afterTaxROIC: number         // Unadjusted after-tax ROIC
    numberOfFirms: number        // Sample size for reference
}

/**
 * Damodaran Industry Benchmarks (January 2026)
 * Extracted from official XLS files: margin.xls and roc.xls
 */
export const DAMODARAN_INDUSTRIES: Record<string, IndustryBenchmark> = {
    // Technology
    'Semiconductor': { operatingMargin: 0.35, afterTaxROIC: 0.41, numberOfFirms: 66 },
    'Semiconductor Equip': { operatingMargin: 0.26, afterTaxROIC: 0.45, numberOfFirms: 31 },
    'Software (System & Application)': { operatingMargin: 0.33, afterTaxROIC: 0.54, numberOfFirms: 309 },
    'Software (Entertainment)': { operatingMargin: 0.34, afterTaxROIC: 0.47, numberOfFirms: 77 },
    'Software (Internet)': { operatingMargin: 0.04, afterTaxROIC: 0.06, numberOfFirms: 29 },
    'Computer Services': { operatingMargin: 0.07, afterTaxROIC: 0.39, numberOfFirms: 64 },
    'Computers/Peripherals': { operatingMargin: 0.22, afterTaxROIC: 0.84, numberOfFirms: 36 },
    'Electronics (General)': { operatingMargin: 0.10, afterTaxROIC: 0.24, numberOfFirms: 114 },
    'Electronics (Consumer & Office)': { operatingMargin: -0.04, afterTaxROIC: -0.32, numberOfFirms: 8 },
    'Information Services': { operatingMargin: 0.12, afterTaxROIC: 0.28, numberOfFirms: 15 },
    'Telecom. Equipment': { operatingMargin: 0.21, afterTaxROIC: 0.54, numberOfFirms: 57 },
    'Telecom (Wireless)': { operatingMargin: 0.21, afterTaxROIC: 0.13, numberOfFirms: 12 },
    'Telecom. Services': { operatingMargin: 0.20, afterTaxROIC: 0.13, numberOfFirms: 39 },

    // Healthcare
    'Drugs (Biotechnology)': { operatingMargin: 0.09, afterTaxROIC: 0.08, numberOfFirms: 496 },
    'Drugs (Pharmaceutical)': { operatingMargin: 0.30, afterTaxROIC: 0.33, numberOfFirms: 228 },
    'Healthcare Products': { operatingMargin: 0.15, afterTaxROIC: 0.23, numberOfFirms: 204 },
    'Healthcare Support Services': { operatingMargin: 0.03, afterTaxROIC: 0.38, numberOfFirms: 104 },
    'Heathcare Information and Technology': { operatingMargin: 0.15, afterTaxROIC: 0.18, numberOfFirms: 115 },
    'Hospitals/Healthcare Facilities': { operatingMargin: 0.13, afterTaxROIC: 0.29, numberOfFirms: 31 },

    // Financial Services
    'Brokerage & Investment Banking': { operatingMargin: 0.00, afterTaxROIC: 0.00, numberOfFirms: 32 },
    'Insurance (General)': { operatingMargin: 0.21, afterTaxROIC: 0.51, numberOfFirms: 21 },
    'Insurance (Life)': { operatingMargin: 0.11, afterTaxROIC: 0.11, numberOfFirms: 20 },
    'Insurance (Prop/Cas.)': { operatingMargin: 0.15, afterTaxROIC: 0.19, numberOfFirms: 57 },
    'Investments & Asset Management': { operatingMargin: 0.26, afterTaxROIC: 0.15, numberOfFirms: 283 },
    'Reinsurance': { operatingMargin: 0.07, afterTaxROIC: 0.10, numberOfFirms: 1 },

    // Consumer Cyclical
    'Retail (General)': { operatingMargin: 0.07, afterTaxROIC: 0.25, numberOfFirms: 23 },
    'Retail (Grocery and Food)': { operatingMargin: 0.02, afterTaxROIC: 0.14, numberOfFirms: 15 },
    'Retail (Online)': { operatingMargin: 0.08, afterTaxROIC: 0.43, numberOfFirms: 94 },
    'Retail (Special Lines)': { operatingMargin: 0.08, afterTaxROIC: 0.43, numberOfFirms: 94 },
    'Retail (Automotive)': { operatingMargin: 0.06, afterTaxROIC: 0.15, numberOfFirms: 34 },
    'Retail (Building Supply)': { operatingMargin: 0.12, afterTaxROIC: 0.47, numberOfFirms: 14 },
    'Retail (Distributors)': { operatingMargin: 0.10, afterTaxROIC: 0.17, numberOfFirms: 62 },
    'Restaurant/Dining': { operatingMargin: 0.16, afterTaxROIC: 0.37, numberOfFirms: 64 },
    'Entertainment': { operatingMargin: 0.11, afterTaxROIC: 0.16, numberOfFirms: 92 },
    'Recreation': { operatingMargin: 0.10, afterTaxROIC: 0.14, numberOfFirms: 49 },
    'Hotel/Gaming': { operatingMargin: 0.19, afterTaxROIC: 0.25, numberOfFirms: 63 },
    'Household Products': { operatingMargin: 0.19, afterTaxROIC: 0.42, numberOfFirms: 110 },
    'Food Processing': { operatingMargin: 0.11, afterTaxROIC: 0.17, numberOfFirms: 78 },
    'Food Wholesalers': { operatingMargin: 0.03, afterTaxROIC: 0.22, numberOfFirms: 13 },
    'Beverage (Alcoholic)': { operatingMargin: 0.23, afterTaxROIC: 0.16, numberOfFirms: 14 },
    'Beverage (Soft)': { operatingMargin: 0.21, afterTaxROIC: 0.31, numberOfFirms: 27 },
    'Tobacco': { operatingMargin: 0.44, afterTaxROIC: 0.69, numberOfFirms: 10 },
    'Apparel': { operatingMargin: 0.09, afterTaxROIC: 0.20, numberOfFirms: 35 },
    'Shoe': { operatingMargin: 0.09, afterTaxROIC: 0.25, numberOfFirms: 11 },
    'Furn/Home Furnishings': { operatingMargin: 0.07, afterTaxROIC: 0.13, numberOfFirms: 27 },
    'Homebuilding': { operatingMargin: 0.13, afterTaxROIC: 0.15, numberOfFirms: 30 },

    // Industrials
    'Aerospace/Defense': { operatingMargin: 0.09, afterTaxROIC: 0.23, numberOfFirms: 79 },
    'Air Transport': { operatingMargin: 0.05, afterTaxROIC: 0.12, numberOfFirms: 23 },
    'Auto & Truck': { operatingMargin: 0.02, afterTaxROIC: 0.02, numberOfFirms: 33 },
    'Auto Parts': { operatingMargin: 0.06, afterTaxROIC: 0.12, numberOfFirms: 35 },
    'Building Materials': { operatingMargin: 0.13, afterTaxROIC: 0.23, numberOfFirms: 41 },
    'Engineering/Construction': { operatingMargin: 0.06, afterTaxROIC: 0.28, numberOfFirms: 48 },
    'Electrical Equipment': { operatingMargin: 0.10, afterTaxROIC: 0.20, numberOfFirms: 112 },
    'Machinery': { operatingMargin: 0.16, afterTaxROIC: 0.28, numberOfFirms: 105 },
    'Packaging & Container': { operatingMargin: 0.10, afterTaxROIC: 0.16, numberOfFirms: 19 },
    'Paper/Forest Products': { operatingMargin: 0.06, afterTaxROIC: 0.10, numberOfFirms: 6 },
    'Transportation (Railroads)': { operatingMargin: 0.37, afterTaxROIC: 0.15, numberOfFirms: 4 },
    'Trucking': { operatingMargin: 0.07, afterTaxROIC: 0.09, numberOfFirms: 26 },
    'Shipbuilding & Marine': { operatingMargin: 0.13, afterTaxROIC: 0.12, numberOfFirms: 8 },
    'Transportation': { operatingMargin: 0.08, afterTaxROIC: 0.17, numberOfFirms: 19 },
    'Rubber& Tires': { operatingMargin: 0.02, afterTaxROIC: 0.03, numberOfFirms: 3 },

    // Energy
    'Oil/Gas (Integrated)': { operatingMargin: 0.11, afterTaxROIC: 0.08, numberOfFirms: 4 },
    'Oil/Gas (Production and Exploration)': { operatingMargin: 0.25, afterTaxROIC: 0.14, numberOfFirms: 142 },
    'Oil/Gas Distribution': { operatingMargin: 0.26, afterTaxROIC: 0.12, numberOfFirms: 23 },
    'Oilfield Svcs/Equip.': { operatingMargin: 0.05, afterTaxROIC: 0.13, numberOfFirms: 97 },
    'Coal & Related Energy': { operatingMargin: -0.04, afterTaxROIC: -0.05, numberOfFirms: 16 },
    'Green & Renewable Energy': { operatingMargin: 0.20, afterTaxROIC: 0.04, numberOfFirms: 15 },

    // Utilities
    'Utility (General)': { operatingMargin: 0.23, afterTaxROIC: 0.06, numberOfFirms: 14 },
    'Utility (Water)': { operatingMargin: 0.34, afterTaxROIC: 0.07, numberOfFirms: 14 },
    'Power': { operatingMargin: 0.21, afterTaxROIC: 0.07, numberOfFirms: 46 },

    // Real Estate
    'R.E.I.T.': { operatingMargin: 0.25, afterTaxROIC: 0.04, numberOfFirms: 190 },
    'Real Estate (Development)': { operatingMargin: 0.22, afterTaxROIC: 0.07, numberOfFirms: 14 },
    'Real Estate (General/Diversified)': { operatingMargin: 0.21, afterTaxROIC: 0.05, numberOfFirms: 12 },
    'Real Estate (Operations & Services)': { operatingMargin: 0.03, afterTaxROIC: 0.07, numberOfFirms: 54 },

    // Basic Materials
    'Metals & Mining': { operatingMargin: 0.24, afterTaxROIC: 0.28, numberOfFirms: 73 },
    'Steel': { operatingMargin: 0.04, afterTaxROIC: 0.07, numberOfFirms: 19 },
    'Precious Metals': { operatingMargin: 0.40, afterTaxROIC: 0.26, numberOfFirms: 56 },
    'Chemical (Basic)': { operatingMargin: 0.03, afterTaxROIC: 0.04, numberOfFirms: 29 },
    'Chemical (Diversified)': { operatingMargin: 0.03, afterTaxROIC: 0.04, numberOfFirms: 4 },
    'Chemical (Specialty)': { operatingMargin: 0.12, afterTaxROIC: 0.12, numberOfFirms: 59 },
    'Farming/Agriculture': { operatingMargin: 0.05, afterTaxROIC: 0.08, numberOfFirms: 35 },

    // Communication Services
    'Advertising': { operatingMargin: 0.10, afterTaxROIC: 0.62, numberOfFirms: 52 },
    'Broadcasting': { operatingMargin: 0.12, afterTaxROIC: 0.16, numberOfFirms: 24 },
    'Cable TV': { operatingMargin: 0.18, afterTaxROIC: 0.13, numberOfFirms: 9 },
    'Publishing & Newspapers': { operatingMargin: 0.10, afterTaxROIC: 0.23, numberOfFirms: 19 },

    // Other
    'Business & Consumer Services': { operatingMargin: 0.12, afterTaxROIC: 0.36, numberOfFirms: 155 },
    'Education': { operatingMargin: 0.14, afterTaxROIC: 0.27, numberOfFirms: 32 },
    'Environmental & Waste Services': { operatingMargin: 0.15, afterTaxROIC: 0.35, numberOfFirms: 53 },
    'Office Equipment & Services': { operatingMargin: 0.11, afterTaxROIC: 0.25, numberOfFirms: 14 },
    'Diversified': { operatingMargin: 0.23, afterTaxROIC: 0.15, numberOfFirms: 20 },

    // Total Market fallback
    'Total Market': { operatingMargin: 0.13, afterTaxROIC: 0.19, numberOfFirms: 4822 },
}

// ============================================================
// FMP Industry → Damodaran Industry Mapping
// ============================================================

/**
 * Maps FMP industry names to Damodaran industry names
 * FMP uses different naming conventions, this normalizes them
 */
export const FMP_TO_DAMODARAN: Record<string, string> = {
    // Technology - Semiconductors
    'Semiconductors': 'Semiconductor',
    'Semiconductor Equipment & Materials': 'Semiconductor Equip',

    // Technology - Software
    'Software—Application': 'Software (System & Application)',
    'Software—Infrastructure': 'Software (System & Application)',
    'Software - Application': 'Software (System & Application)',
    'Software - Infrastructure': 'Software (System & Application)',
    'Electronic Gaming & Multimedia': 'Software (Entertainment)',
    'Information Technology Services': 'Computer Services',
    'Internet Content & Information': 'Software (Internet)',

    // Technology - Hardware
    'Computer Hardware': 'Computers/Peripherals',
    'Consumer Electronics': 'Electronics (Consumer & Office)',
    'Electronic Components': 'Electronics (General)',
    'Scientific & Technical Instruments': 'Electronics (General)',
    'Communication Equipment': 'Telecom. Equipment',

    // Healthcare
    'Biotechnology': 'Drugs (Biotechnology)',
    'Drug Manufacturers—General': 'Drugs (Pharmaceutical)',
    'Drug Manufacturers—Specialty & Generic': 'Drugs (Pharmaceutical)',
    'Drug Manufacturers - General': 'Drugs (Pharmaceutical)',
    'Drug Manufacturers - Specialty & Generic': 'Drugs (Pharmaceutical)',
    'Medical Devices': 'Healthcare Products',
    'Medical Instruments & Supplies': 'Healthcare Products',
    'Diagnostics & Research': 'Healthcare Products',
    'Healthcare Plans': 'Healthcare Support Services',
    'Medical Care Facilities': 'Hospitals/Healthcare Facilities',
    'Pharmaceutical Retailers': 'Retail (Special Lines)',
    'Health Information Services': 'Heathcare Information and Technology',

    // Financial Services
    'Banks—Diversified': 'Brokerage & Investment Banking',
    'Banks—Regional': 'Brokerage & Investment Banking',
    'Banks - Diversified': 'Brokerage & Investment Banking',
    'Banks - Regional': 'Brokerage & Investment Banking',
    'Capital Markets': 'Brokerage & Investment Banking',
    'Asset Management': 'Investments & Asset Management',
    'Insurance—Life': 'Insurance (Life)',
    'Insurance—Property & Casualty': 'Insurance (Prop/Cas.)',
    'Insurance—Diversified': 'Insurance (General)',
    'Insurance - Life': 'Insurance (Life)',
    'Insurance - Property & Casualty': 'Insurance (Prop/Cas.)',
    'Insurance - Diversified': 'Insurance (General)',
    'Insurance Brokers': 'Insurance (General)',
    'Credit Services': 'Brokerage & Investment Banking',
    'Financial Data & Stock Exchanges': 'Brokerage & Investment Banking',
    'Mortgage Finance': 'Brokerage & Investment Banking',

    // Consumer Cyclical
    'Auto Manufacturers': 'Auto & Truck',
    'Auto Parts': 'Auto Parts',
    'Auto & Truck Dealerships': 'Retail (Automotive)',
    'Recreational Vehicles': 'Auto & Truck',
    'Specialty Retail': 'Retail (Special Lines)',
    'Home Improvement Retail': 'Retail (Building Supply)',
    'Apparel Retail': 'Apparel',
    'Department Stores': 'Retail (General)',
    'Discount Stores': 'Retail (General)',
    'Internet Retail': 'Retail (Online)',
    'Restaurants': 'Restaurant/Dining',
    'Resorts & Casinos': 'Hotel/Gaming',
    'Lodging': 'Hotel/Gaming',
    'Travel Services': 'Hotel/Gaming',
    'Gambling': 'Hotel/Gaming',
    'Leisure': 'Recreation',
    'Apparel Manufacturing': 'Apparel',
    'Footwear & Accessories': 'Shoe',
    'Textile Manufacturing': 'Apparel',
    'Luxury Goods': 'Household Products',
    'Residential Construction': 'Homebuilding',
    'Furnishings, Fixtures & Appliances': 'Furn/Home Furnishings',
    'Packaging & Containers': 'Packaging & Container',

    // Consumer Defensive
    'Beverages—Non-Alcoholic': 'Beverage (Soft)',
    'Beverages—Brewers': 'Beverage (Alcoholic)',
    'Beverages—Wineries & Distilleries': 'Beverage (Alcoholic)',
    'Beverages - Non-Alcoholic': 'Beverage (Soft)',
    'Beverages - Brewers': 'Beverage (Alcoholic)',
    'Beverages - Wineries & Distilleries': 'Beverage (Alcoholic)',
    'Confectioners': 'Food Processing',
    'Farm Products': 'Farming/Agriculture',
    'Food Distribution': 'Food Wholesalers',
    'Grocery Stores': 'Retail (Grocery and Food)',
    'Household & Personal Products': 'Household Products',
    'Packaged Foods': 'Food Processing',
    'Tobacco': 'Tobacco',
    'Education & Training Services': 'Education',
    'Personal Services': 'Business & Consumer Services',

    // Industrials
    'Aerospace & Defense': 'Aerospace/Defense',
    'Airlines': 'Air Transport',
    'Airports & Air Services': 'Air Transport',
    'Building Products & Equipment': 'Building Materials',
    'Business Equipment & Supplies': 'Office Equipment & Services',
    'Conglomerates': 'Diversified',
    'Consulting Services': 'Business & Consumer Services',
    'Electrical Equipment & Parts': 'Electrical Equipment',
    'Engineering & Construction': 'Engineering/Construction',
    'Farm & Heavy Construction Machinery': 'Machinery',
    'Industrial Distribution': 'Retail (Distributors)',
    'Infrastructure Operations': 'Business & Consumer Services',
    'Integrated Freight & Logistics': 'Transportation',
    'Marine Shipping': 'Shipbuilding & Marine',
    'Metal Fabrication': 'Machinery',
    'Pollution & Treatment Controls': 'Environmental & Waste Services',
    'Railroads': 'Transportation (Railroads)',
    'Rental & Leasing Services': 'Business & Consumer Services',
    'Security & Protection Services': 'Business & Consumer Services',
    'Specialty Business Services': 'Business & Consumer Services',
    'Specialty Industrial Machinery': 'Machinery',
    'Staffing & Employment Services': 'Business & Consumer Services',
    'Tools & Accessories': 'Machinery',
    'Trucking': 'Trucking',
    'Waste Management': 'Environmental & Waste Services',

    // Energy
    'Oil & Gas Integrated': 'Oil/Gas (Integrated)',
    'Oil & Gas E&P': 'Oil/Gas (Production and Exploration)',
    'Oil & Gas Midstream': 'Oil/Gas Distribution',
    'Oil & Gas Equipment & Services': 'Oilfield Svcs/Equip.',
    'Oil & Gas Refining & Marketing': 'Oil/Gas (Integrated)',
    'Oil & Gas Drilling': 'Oilfield Svcs/Equip.',
    'Thermal Coal': 'Coal & Related Energy',
    'Uranium': 'Coal & Related Energy',

    // Utilities
    'Utilities—Regulated Electric': 'Utility (General)',
    'Utilities—Regulated Gas': 'Utility (General)',
    'Utilities—Regulated Water': 'Utility (Water)',
    'Utilities—Diversified': 'Utility (General)',
    'Utilities—Independent Power Producers': 'Power',
    'Utilities—Renewable': 'Green & Renewable Energy',
    'Utilities - Regulated Electric': 'Utility (General)',
    'Utilities - Regulated Gas': 'Utility (General)',
    'Utilities - Regulated Water': 'Utility (Water)',
    'Utilities - Diversified': 'Utility (General)',
    'Utilities - Independent Power Producers': 'Power',
    'Utilities - Renewable': 'Green & Renewable Energy',

    // Real Estate
    'REIT—Diversified': 'R.E.I.T.',
    'REIT—Healthcare Facilities': 'R.E.I.T.',
    'REIT—Hotel & Motel': 'R.E.I.T.',
    'REIT—Industrial': 'R.E.I.T.',
    'REIT—Mortgage': 'R.E.I.T.',
    'REIT—Office': 'R.E.I.T.',
    'REIT—Residential': 'R.E.I.T.',
    'REIT—Retail': 'R.E.I.T.',
    'REIT—Specialty': 'R.E.I.T.',
    'REIT - Diversified': 'R.E.I.T.',
    'REIT - Healthcare Facilities': 'R.E.I.T.',
    'REIT - Hotel & Motel': 'R.E.I.T.',
    'REIT - Industrial': 'R.E.I.T.',
    'REIT - Mortgage': 'R.E.I.T.',
    'REIT - Office': 'R.E.I.T.',
    'REIT - Residential': 'R.E.I.T.',
    'REIT - Retail': 'R.E.I.T.',
    'REIT - Specialty': 'R.E.I.T.',
    'Real Estate Services': 'Real Estate (Operations & Services)',
    'Real Estate—Development': 'Real Estate (Development)',
    'Real Estate—Diversified': 'Real Estate (General/Diversified)',
    'Real Estate - Development': 'Real Estate (Development)',
    'Real Estate - Diversified': 'Real Estate (General/Diversified)',

    // Basic Materials
    'Aluminum': 'Metals & Mining',
    'Building Materials': 'Building Materials',
    'Chemicals': 'Chemical (Diversified)',
    'Coking Coal': 'Coal & Related Energy',
    'Copper': 'Metals & Mining',
    'Gold': 'Precious Metals',
    'Lumber & Wood Production': 'Paper/Forest Products',
    'Other Industrial Metals & Mining': 'Metals & Mining',
    'Other Precious Metals & Mining': 'Precious Metals',
    'Paper & Paper Products': 'Paper/Forest Products',
    'Silver': 'Precious Metals',
    'Specialty Chemicals': 'Chemical (Specialty)',
    'Steel': 'Steel',
    'Agricultural Inputs': 'Chemical (Basic)',

    // Communication Services
    'Advertising Agencies': 'Advertising',
    'Broadcasting': 'Broadcasting',
    'Entertainment': 'Entertainment',
    'Publishing': 'Publishing & Newspapers',
    'Telecom Services': 'Telecom. Services',
}

// ============================================================
// FMP Sector → Default Damodaran Industry (Fallback)
// ============================================================

/**
 * When FMP industry doesn't match, use sector-level defaults
 */
export const FMP_SECTOR_DEFAULTS: Record<string, string> = {
    'Technology': 'Software (System & Application)',
    'Healthcare': 'Healthcare Products',
    'Financial Services': 'Investments & Asset Management',
    'Consumer Cyclical': 'Retail (Special Lines)',
    'Consumer Defensive': 'Food Processing',
    'Industrials': 'Business & Consumer Services',
    'Energy': 'Oil/Gas (Production and Exploration)',
    'Utilities': 'Utility (General)',
    'Real Estate': 'R.E.I.T.',
    'Basic Materials': 'Chemical (Specialty)',
    'Communication Services': 'Entertainment',
}

// ============================================================
// Lookup Functions
// ============================================================

/**
 * Get industry benchmark for a given FMP industry and sector
 * Returns the most specific match available
 */
export function getIndustryBenchmark(
    fmpIndustry: string | undefined,
    fmpSector: string | undefined
): IndustryBenchmark {
    // Try exact industry match first
    if (fmpIndustry) {
        const damodaranIndustry = FMP_TO_DAMODARAN[fmpIndustry]
        if (damodaranIndustry && DAMODARAN_INDUSTRIES[damodaranIndustry]) {
            return DAMODARAN_INDUSTRIES[damodaranIndustry]
        }
    }

    // Fall back to sector default
    if (fmpSector) {
        const defaultIndustry = FMP_SECTOR_DEFAULTS[fmpSector]
        if (defaultIndustry && DAMODARAN_INDUSTRIES[defaultIndustry]) {
            return DAMODARAN_INDUSTRIES[defaultIndustry]
        }
    }

    // Ultimate fallback: total market average
    return DAMODARAN_INDUSTRIES['Total Market']
}

/**
 * Get the Damodaran industry name for display
 */
export function getDamodaranIndustryName(
    fmpIndustry: string | undefined,
    fmpSector: string | undefined
): string {
    if (fmpIndustry) {
        const damodaranIndustry = FMP_TO_DAMODARAN[fmpIndustry]
        if (damodaranIndustry && DAMODARAN_INDUSTRIES[damodaranIndustry]) {
            return damodaranIndustry
        }
    }

    if (fmpSector) {
        const defaultIndustry = FMP_SECTOR_DEFAULTS[fmpSector]
        if (defaultIndustry) {
            return `${defaultIndustry} (Sector Default)`
        }
    }

    return 'Total Market (Fallback)'
}

/**
 * Calculate feasibility thresholds based on industry benchmarks
 * Returns P75 and P90 equivalent thresholds for warnings
 */
export function getIndustryThresholds(benchmark: IndustryBenchmark): {
    marginWarning: number      // Margin above this triggers warning (P75)
    marginError: number        // Margin above this is unrealistic (P90)
    roicWarning: number        // ROIC above this triggers warning (P75)
    roicError: number          // ROIC above this is unrealistic (P90)
} {
    // Industry benchmarks represent medians
    // Use multipliers to estimate P75 and P90
    // For 2026 data, ROIC values are higher so use smaller multipliers

    const baseMargin = Math.max(benchmark.operatingMargin, 0.05)
    const baseROIC = Math.max(benchmark.afterTaxROIC, 0.05)

    return {
        marginWarning: Math.min(baseMargin * 1.5, 0.50),  // Cap at 50%
        marginError: Math.min(baseMargin * 2.0, 0.60),    // Cap at 60%
        roicWarning: Math.min(baseROIC * 1.3, 0.60),      // Cap at 60% (lower multiplier due to higher base)
        roicError: Math.min(baseROIC * 1.6, 0.80),        // Cap at 80%
    }
}
