export interface ChartSeries {
    key: string
    label: string
    /** CSS color: a theme variable (features/theme/palettes.ts) so it keeps 3:1 against the surface in both themes. */
    color: string
}
