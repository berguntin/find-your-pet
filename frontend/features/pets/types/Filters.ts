export type SpeciesFilter = 'all' | import('~~/contracts/pets').Species

export interface Filters {
    reportType: ReportTypeFilter
    species: SpeciesFilter
}
