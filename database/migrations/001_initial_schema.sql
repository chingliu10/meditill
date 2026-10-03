CREATE TABLE organizations (
  id bigserial PRIMARY KEY,
  name varchar(180) NOT NULL,
  phone varchar(60),
  email varchar(180),
  address text,
  currency varchar(10) NOT NULL DEFAULT 'TZS',
  timezone varchar(80) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  code varchar(40) NOT NULL,
  phone varchar(60),
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,code)
);

CREATE TABLE users (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  default_branch_id bigint REFERENCES branches(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  username varchar(80) NOT NULL,
  email varchar(180),
  phone varchar(60),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,username)
);

CREATE TABLE roles (
  id bigserial PRIMARY KEY,
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  UNIQUE(organization_id,name)
);

CREATE TABLE permissions (
  id bigserial PRIMARY KEY,
  code varchar(120) NOT NULL UNIQUE,
  description text
);

CREATE TABLE user_roles (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,role_id)
);

CREATE TABLE role_permissions (
  role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id,permission_id)
);

CREATE TABLE user_branches (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,branch_id)
);

CREATE TABLE categories (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id,name)
);

CREATE TABLE manufacturers (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  country varchar(100),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE units (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  symbol varchar(20),
  allow_fraction boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id,name)
);

CREATE TABLE medicines (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
  manufacturer_id bigint REFERENCES manufacturers(id) ON DELETE SET NULL,
  base_unit_id bigint REFERENCES units(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  generic_name varchar(180),
  brand_name varchar(180),
  strength varchar(80),
  dosage_form varchar(80),
  sku varchar(100),
  default_selling_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(default_selling_price>=0),
  reorder_level numeric(18,4) NOT NULL DEFAULT 0 CHECK(reorder_level>=0),
  prescription_required boolean NOT NULL DEFAULT false,
  track_expiry boolean NOT NULL DEFAULT true,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_medicines_sku ON medicines(organization_id,sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_medicines_name ON medicines(organization_id,lower(name));
CREATE INDEX idx_medicines_generic ON medicines(organization_id,lower(generic_name));

CREATE TABLE medicine_barcodes (
  id bigserial PRIMARY KEY,
  medicine_id bigint NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  barcode varchar(180) NOT NULL UNIQUE,
  barcode_type varchar(30) NOT NULL DEFAULT 'EAN',
  is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE medicine_units (
  id bigserial PRIMARY KEY,
  medicine_id bigint NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  conversion_to_base numeric(18,4) NOT NULL CHECK(conversion_to_base>0),
  barcode varchar(180) UNIQUE,
  selling_price numeric(18,2),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(medicine_id,name)
);

CREATE TABLE suppliers (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  contact_person varchar(160),
  phone varchar(60),
  email varchar(180),
  address text,
  tax_number varchar(100),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  phone varchar(60),
  email varchar(180),
  address text,
  is_walk_in boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_sequences (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint REFERENCES branches(id) ON DELETE CASCADE,
  document_type varchar(40) NOT NULL,
  prefix varchar(20) NOT NULL,
  next_number bigint NOT NULL DEFAULT 1 CHECK(next_number>0),
  padding integer NOT NULL DEFAULT 6,
  UNIQUE(organization_id,branch_id,document_type)
);

CREATE TABLE purchases (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  supplier_id bigint REFERENCES suppliers(id),
  purchase_number varchar(80) NOT NULL,
  supplier_invoice_number varchar(120),
  purchase_date timestamptz NOT NULL DEFAULT now(),
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  discount numeric(18,2) NOT NULL DEFAULT 0,
  tax numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'RECEIVED' CHECK(status IN('DRAFT','RECEIVED','PARTIALLY_RECEIVED','CANCELLED')),
  payment_status varchar(30) NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN('UNPAID','PARTIAL','PAID')),
  notes text,
  created_by bigint REFERENCES users(id),
  received_at timestamptz,
  UNIQUE(organization_id,purchase_number)
);

CREATE TABLE purchase_items (
  id bigserial PRIMARY KEY,
  purchase_id bigint NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,2) NOT NULL CHECK(unit_cost>=0),
  selling_price numeric(18,2),
  batch_number varchar(120),
  manufacturing_date date,
  expiry_date date,
  line_total numeric(18,2) NOT NULL CHECK(line_total>=0)
);

CREATE TABLE medicine_batches (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  purchase_item_id bigint REFERENCES purchase_items(id),
  batch_number varchar(120),
  manufacturing_date date,
  expiry_date date,
  unit_cost numeric(18,2) NOT NULL DEFAULT 0,
  default_selling_price numeric(18,2),
  quantity_received numeric(18,4) NOT NULL CHECK(quantity_received>=0),
  quantity_available numeric(18,4) NOT NULL CHECK(quantity_available>=0),
  status varchar(30) NOT NULL DEFAULT 'SALEABLE' CHECK(status IN('SALEABLE','QUARANTINED','EXPIRED','DAMAGED','RECALLED','DEPLETED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_fefo ON medicine_batches(branch_id,medicine_id,status,expiry_date,received_at);

CREATE TABLE stock_movements (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  batch_id bigint REFERENCES medicine_batches(id),
  movement_type varchar(40) NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK(quantity<>0),
  unit_cost numeric(18,2),
  reference_type varchar(50),
  reference_id bigint,
  notes text,
  performed_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_lookup ON stock_movements(branch_id,medicine_id,created_at DESC);

CREATE TABLE registers (
  id bigserial PRIMARY KEY,
  branch_id bigint NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(branch_id,name)
);

CREATE TABLE register_sessions (
  id bigserial PRIMARY KEY,
  register_id bigint NOT NULL REFERENCES registers(id),
  branch_id bigint NOT NULL REFERENCES branches(id),
  user_id bigint NOT NULL REFERENCES users(id),
  opening_cash numeric(18,2) NOT NULL DEFAULT 0 CHECK(opening_cash>=0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  expected_cash numeric(18,2),
  actual_cash numeric(18,2),
  difference numeric(18,2),
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED'))
);
CREATE UNIQUE INDEX uq_open_register_user ON register_sessions(user_id) WHERE status='OPEN';

CREATE TABLE register_movements (
  id bigserial PRIMARY KEY,
  register_session_id bigint NOT NULL REFERENCES register_sessions(id) ON DELETE CASCADE,
  movement_type varchar(30) NOT NULL CHECK(movement_type IN('OPENING','CASH_SALE','CASH_REFUND','CASH_IN','CASH_OUT','EXPENSE')),
  amount numeric(18,2) NOT NULL CHECK(amount>=0),
  reference_type varchar(50),
  reference_id bigint,
  notes text,
  performed_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  register_session_id bigint REFERENCES register_sessions(id),
  customer_id bigint REFERENCES customers(id),
  user_id bigint NOT NULL REFERENCES users(id),
  sale_number varchar(80) NOT NULL,
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  discount numeric(18,2) NOT NULL DEFAULT 0,
  tax numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  change_amount numeric(18,2) NOT NULL DEFAULT 0,
  payment_status varchar(20) NOT NULL DEFAULT 'PAID' CHECK(payment_status IN('UNPAID','PARTIAL','PAID')),
  status varchar(30) NOT NULL DEFAULT 'COMPLETED' CHECK(status IN('COMPLETED','VOIDED','PARTIALLY_REFUNDED','REFUNDED')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,sale_number)
);

CREATE TABLE sale_items (
  id bigserial PRIMARY KEY,
  sale_id bigint NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_price numeric(18,2) NOT NULL CHECK(unit_price>=0),
  discount numeric(18,2) NOT NULL DEFAULT 0,
  line_total numeric(18,2) NOT NULL CHECK(line_total>=0)
);

CREATE TABLE sale_item_batches (
  id bigserial PRIMARY KEY,
  sale_item_id bigint NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  batch_id bigint NOT NULL REFERENCES medicine_batches(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,2) NOT NULL CHECK(unit_cost>=0)
);

CREATE TABLE sale_payments (
  id bigserial PRIMARY KEY,
  sale_id bigint NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  register_session_id bigint REFERENCES register_sessions(id),
  payment_method varchar(30) NOT NULL CHECK(payment_method IN('CASH','MOBILE_MONEY','CARD','BANK','CREDIT')),
  amount numeric(18,2) NOT NULL CHECK(amount>0),
  reference varchar(180),
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sale_returns (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  sale_id bigint NOT NULL REFERENCES sales(id),
  return_number varchar(80) NOT NULL,
  reason text NOT NULL,
  total_refund numeric(18,2) NOT NULL DEFAULT 0,
  created_by bigint NOT NULL REFERENCES users(id),
  approved_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sale_return_items (
  id bigserial PRIMARY KEY,
  sale_return_id bigint NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id bigint NOT NULL REFERENCES sale_items(id),
  batch_id bigint REFERENCES medicine_batches(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  refund_amount numeric(18,2) NOT NULL DEFAULT 0,
  stock_disposition varchar(30) NOT NULL CHECK(stock_disposition IN('RETURN_TO_STOCK','DAMAGED','QUARANTINED'))
);

CREATE TABLE stock_adjustments (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  adjustment_number varchar(80) NOT NULL,
  reason varchar(40) NOT NULL,
  notes text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_adjustment_items (
  id bigserial PRIMARY KEY,
  adjustment_id bigint NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  batch_id bigint REFERENCES medicine_batches(id),
  quantity_change numeric(18,4) NOT NULL CHECK(quantity_change<>0),
  notes text
);

CREATE TABLE stock_transfers (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_branch_id bigint NOT NULL REFERENCES branches(id),
  to_branch_id bigint NOT NULL REFERENCES branches(id),
  transfer_number varchar(80) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SENT','IN_TRANSIT','RECEIVED','CANCELLED')),
  created_by bigint NOT NULL REFERENCES users(id),
  sent_at timestamptz,
  received_at timestamptz,
  received_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(from_branch_id<>to_branch_id)
);

CREATE TABLE stock_transfer_items (
  id bigserial PRIMARY KEY,
  transfer_id bigint NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  batch_id bigint REFERENCES medicine_batches(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity>0)
);

CREATE TABLE stock_counts (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  count_number varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','COMPLETED','CANCELLED')),
  started_by bigint NOT NULL REFERENCES users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE stock_count_items (
  id bigserial PRIMARY KEY,
  stock_count_id bigint NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  medicine_id bigint NOT NULL REFERENCES medicines(id),
  batch_id bigint REFERENCES medicine_batches(id),
  system_quantity numeric(18,4) NOT NULL,
  counted_quantity numeric(18,4),
  difference numeric(18,4)
);

CREATE TABLE expenses (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint NOT NULL REFERENCES branches(id),
  register_session_id bigint REFERENCES register_sessions(id),
  category varchar(100) NOT NULL,
  description text,
  amount numeric(18,2) NOT NULL CHECK(amount>0),
  payment_method varchar(30) NOT NULL CHECK(payment_method IN('CASH','MOBILE_MONEY','CARD','BANK')),
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint REFERENCES branches(id),
  user_id bigint REFERENCES users(id),
  action varchar(100) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id bigint,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id bigint REFERENCES branches(id) ON DELETE CASCADE,
  key varchar(120) NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by bigint REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_settings_scope ON settings(organization_id,COALESCE(branch_id,0),key);

CREATE TABLE session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session(expire);
