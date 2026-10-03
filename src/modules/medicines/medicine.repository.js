async function list(db,organizationId,q='',branchId=null){
  const term=`%${q.trim()}%`;
  const {rows}=await db.query(
    `SELECT
      m.id,m.name,m.generic_name,m.brand_name,m.strength,m.dosage_form,m.sku,
      m.default_selling_price,m.reorder_level,m.image_path,
      c.name category,
      u.name unit_name,
      u.symbol unit,
      COALESCE(u.allow_fraction,false) allow_fraction,
      (SELECT barcode FROM medicine_barcodes mb
       WHERE mb.medicine_id=m.id
       ORDER BY is_primary DESC,id
       LIMIT 1) barcode,
      CASE WHEN $4::bigint IS NULL THEN NULL ELSE COALESCE((
        SELECT SUM(b.quantity_available)
        FROM medicine_batches b
        WHERE b.medicine_id=m.id
          AND b.branch_id=$4
          AND b.status='SALEABLE'
          AND b.quantity_available>0
          AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
      ),0) END saleable_stock
     FROM medicines m
     LEFT JOIN categories c ON c.id=m.category_id
     LEFT JOIN units u ON u.id=m.base_unit_id
     WHERE m.organization_id=$1
       AND m.active=true
       AND (
         $2=''
         OR m.name ILIKE $3
         OR COALESCE(m.generic_name,'') ILIKE $3
         OR COALESCE(m.brand_name,'') ILIKE $3
         OR COALESCE(m.sku,'') ILIKE $3
         OR EXISTS(
           SELECT 1
           FROM medicine_barcodes mb
           WHERE mb.medicine_id=m.id
             AND mb.barcode ILIKE $3
         )
       )
     ORDER BY m.name
     LIMIT 100`,
    [organizationId,q.trim(),term,branchId]
  );
  return rows;
}

async function masters(db,organizationId){
  const [categories,units,manufacturers]=await Promise.all([
    db.query('SELECT id,name FROM categories WHERE organization_id=$1 AND active=true ORDER BY name',[organizationId]),
    db.query('SELECT id,name,symbol,allow_fraction FROM units WHERE organization_id=$1 AND active=true ORDER BY name',[organizationId]),
    db.query('SELECT id,name FROM manufacturers WHERE organization_id=$1 AND active=true ORDER BY name',[organizationId])
  ]);
  return {categories:categories.rows,units:units.rows,manufacturers:manufacturers.rows};
}

async function create(db,data){
  const {rows}=await db.query(
    `INSERT INTO medicines(
      organization_id,category_id,manufacturer_id,base_unit_id,name,generic_name,
      brand_name,strength,dosage_form,sku,default_selling_price,reorder_level,
      prescription_required,track_expiry,description,created_by
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *`,
    [
      data.organizationId,data.categoryId||null,data.manufacturerId||null,
      data.baseUnitId||null,data.name,data.genericName||null,data.brandName||null,
      data.strength||null,data.dosageForm||null,data.sku||null,data.sellingPrice||0,
      data.reorderLevel||0,!!data.prescriptionRequired,data.trackExpiry!==false,
      data.description||null,data.userId
    ]
  );

  if(data.barcode){
    await db.query(
      'INSERT INTO medicine_barcodes(medicine_id,barcode,is_primary) VALUES($1,$2,true)',
      [rows[0].id,data.barcode]
    );
  }

  return rows[0];
}

async function byBarcode(db,organizationId,branchId,barcode){
  const {rows}=await db.query(
    `SELECT
      m.id,m.name,m.generic_name,m.brand_name,m.strength,m.default_selling_price,m.image_path,
      u.name unit_name,u.symbol unit,COALESCE(u.allow_fraction,false) allow_fraction,
      COALESCE(sum(b.quantity_available) FILTER(
        WHERE b.status='SALEABLE'
          AND (b.expiry_date IS NULL OR b.expiry_date>=current_date)
      ),0) stock
     FROM medicine_barcodes mb
     JOIN medicines m ON m.id=mb.medicine_id
     LEFT JOIN units u ON u.id=m.base_unit_id
     LEFT JOIN medicine_batches b ON b.medicine_id=m.id AND b.branch_id=$2
     WHERE m.organization_id=$1
       AND mb.barcode=$3
       AND m.active=true
     GROUP BY m.id,u.id`,
    [organizationId,branchId,barcode]
  );
  return rows[0]||null;
}

async function quantityRule(db,organizationId,medicineId){
  const {rows}=await db.query(
    `SELECT
      m.id,m.name,
      u.name unit_name,
      u.symbol unit,
      COALESCE(u.allow_fraction,false) allow_fraction
     FROM medicines m
     LEFT JOIN units u ON u.id=m.base_unit_id
     WHERE m.organization_id=$1
       AND m.id=$2
       AND m.active=true
     LIMIT 1`,
    [organizationId,medicineId]
  );
  return rows[0]||null;
}

module.exports={list,masters,create,byBarcode,quantityRule};
