import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {SOURCES, QUARANTINED} from './stop-heat-sources.mjs';

const read = (name) => readFileSync(new URL(`../docs/data/illinois-2025/${name}`, import.meta.url), 'utf8');
const audit = () => JSON.parse(read('audit.json'));
const csvRows = (name) => read(name).trim().split(/\r?\n/).slice(1).map(row => row.split(','));

describe('2025 Illinois traffic review data', () => {
  it('accounts for fourteen alternatives without doubling their seven source extracts', () => {
    const report = audit();
    expect(report.files).toHaveLength(7);
    expect(report.files.reduce((n, file) => n + file.source_rows, 0)).toBe(2063429);
    expect(report.files.every((f) => f.matching_export_equivalent_rows === f.source_rows)).toBe(true);
    expect(report.files.reduce((n, f) => n + f.txt_only_rows, 0)).toBe(30);
    expect(report.files.every((f) => f.invalid_or_out_of_year_dates === 0 && f.unknown_times === 0)).toBe(true);
  });

  it('reconciles coarse CPD summaries and preserves counting uncertainty', () => {
    const rows = csvRows('cpd-beat-month-review.csv');
    expect(rows).toHaveLength(3278);
    expect(rows.reduce((n, r) => n + Number(r[2]), 0)).toBe(224851);
    expect(rows.reduce((n, r) => n + Number(r[3]), 0)).toBe(183);
    expect(rows.reduce((n, r) => n + Number(r[4]), 0)).toBe(224668);
    expect(rows.every(r => /^\d{1,4}$/.test(r[0]) && /^2025-\d{2}$/.test(r[1]) && Number(r[2]) === Number(r[3]) + Number(r[4]))).toBe(true);
    expect(audit().unique_encounters_verified).toBe(false);
  });

  it('retains family ownership so revised local and statewide records cannot be summed', () => {
    const report = audit();
    expect(report.overlaps.cpd.matching_statewide_attribute_rows).toBe(0);
    expect(report.overlaps.lake_bluff.matching_statewide_attribute_rows).toBe(1100);
    expect(report.overlaps.lake_bluff.candidate_agency_total_source_rows).toEqual({'13478': 1104});
    expect(report.overlaps.lake_bluff.geographic_identity_verified).toBe(false);
    const totals = {};
    for (const row of csvRows('agency-month-source-counts.csv')) totals[row[0]] = (totals[row[0]] ?? 0) + Number(row[3]);
    expect(totals).toEqual({statewide: 1837061, cpd: 224851, lake_bluff: 1517});
  });

  it('keeps all new sources out of mapped coverage pending verification', () => {
    for (const id of ['idot_2025_upload', 'cpd_2025_upload', 'lake_bluff_2025_upload']) {
      expect(SOURCES.some((s) => s.id === id)).toBe(false);
      expect(QUARANTINED.some((s) => s.id === id)).toBe(true);
    }
    expect(audit().mapped_records_added).toBe(0);
  });
});
