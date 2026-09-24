# Legacy migration archive

`001_english_column_names.sql` is retained here for audit history only.

It was created before the repository contained the authoritative remote
`20260616...` migrations. Its rename operations overlap those remote migrations
and several source columns do not exist in the remote core schema, so it must
not be part of the active migration chain.

The still-relevant `MUA`/`KM` constraint state is represented explicitly by the
active `20260923011000_align_price_history_row_type.sql` migration.
