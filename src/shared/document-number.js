async function nextDocumentNumber(client, organizationId, branchId, type, prefix) {
  await client.query(
    `INSERT INTO document_sequences(organization_id,branch_id,document_type,prefix,next_number)
     VALUES($1,$2,$3,$4,1)
     ON CONFLICT(organization_id,branch_id,document_type) DO NOTHING`,
    [organizationId, branchId, type, prefix]
  );
  const { rows } = await client.query(
    `UPDATE document_sequences
     SET next_number=next_number+1
     WHERE organization_id=$1 AND branch_id=$2 AND document_type=$3
     RETURNING prefix,next_number-1 AS number,padding`,
    [organizationId, branchId, type]
  );
  const row = rows[0];
  return `${row.prefix}-${String(row.number).padStart(row.padding,'0')}`;
}

module.exports = { nextDocumentNumber };
