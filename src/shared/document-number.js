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
  if (!row) {
    throw new Error(`Document sequence not found for ${type}`);
  }

  let branchCode='';
  if (branchId !== null && branchId !== undefined) {
    const branchResult=await client.query(
      'SELECT code FROM branches WHERE id=$1 AND organization_id=$2 LIMIT 1',
      [branchId,organizationId]
    );
    const raw=String(branchResult.rows[0]?.code||branchId).toUpperCase();
    branchCode=raw.replace(/[^A-Z0-9]/g,'') || String(branchId);
  }

  const serial=String(row.number).padStart(row.padding,'0');
  return branchCode ? `${row.prefix}-${branchCode}-${serial}` : `${row.prefix}-${serial}`;
}

module.exports = { nextDocumentNumber };
