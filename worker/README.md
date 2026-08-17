# worker

Produces `output/jobs.json`, the single data source the API reads.

The real worker is a Python scraper (JobSpy + LinkedIn Uruguay) that is not part
of this checkout. Until its output is dropped in here, `generate_fixture.ts`
writes a deterministic set of 157 synthetic Uruguayan offers with the exact same
schema, so the API and web can be developed and verified end to end.

```bash
bun run fixture
```

The fixture is tagged `"source": "fixture_uy"` (the real scraper writes
`"linkedin_uy"`), so sample data is always distinguishable in the UI header.
Companies and roles are realistic but the offers are not real: every `apply_url`
is a synthetic LinkedIn path and will not resolve.

## Schema

```jsonc
{
  "scraped_at": "ISO8601",
  "source": "linkedin_uy",
  "count": 157,
  "jobs": [
    {
      "id": "12-char-hash",
      "title": "Desarrollador Junior",
      "company": "Empresa SA",
      "location": "Montevideo, Uruguay",
      "date_posted": "2026-08-16T00:00:00",
      "level": "entry | mid | senior | null",
      "remote": "remote | hybrid | null",
      "apply_url": "https://uy.linkedin.com/jobs/view/..."
    }
  ]
}
```

`job_type`, salary and description are not available from LinkedIn via JobSpy
and are intentionally absent.
