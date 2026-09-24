-- Evidence-backed historical product identity cleanup.
-- Sources: invoices IN025639, IN023651, IN023426, and INO24320.
-- Every row is guarded by UUID, exact old name, and NULL product_code.

DO $$
BEGIN
  -- Abort if one of these SKUs is already owned by an unrelated product.
  IF EXISTS (
    WITH planned(product_id, product_code) AS (
      VALUES
        ('def33785-c1d7-4117-a2f4-286fe68f0a5a'::uuid, '01TD12'),
        ('303c8f86-1d48-4b0c-bddb-fa8efe4b96b2'::uuid, '07KD12'),
        ('86901d80-c4b5-408f-8be6-ecb0665058b8'::uuid, '07NC15'),
        ('14302680-8657-4935-8e36-a0b105d84656'::uuid, '07NH12'),
        ('a7d02241-0d99-4d27-b50c-e62533fbf7dc'::uuid, '07SR11'),
        ('0e5926dd-9164-4eb8-9fc0-ae174f0dd5eb'::uuid, '07SR11'),
        ('58b1be4e-a3ce-4c17-b913-a23b506a4344'::uuid, '07UR13'),
        ('5b2750a1-e157-4e20-b28c-13f6a8e86c9a'::uuid, '07UR31')
    )
    SELECT 1
    FROM public.products p
    JOIN planned x ON upper(p.product_code) = x.product_code
    WHERE p.id NOT IN (SELECT product_id FROM planned)
  ) THEN
    RAISE EXCEPTION 'Historical SKU backfill conflicts with an unrelated product';
  END IF;
END;
$$;

WITH planned(product_id, old_name, product_code, clean_name) AS (
  VALUES
    ('def33785-c1d7-4117-a2f4-286fe68f0a5a'::uuid, '01td12-sdcđ ông thọ đỏ 1KG', '01TD12', 'Sdcđ ông thọ đỏ 1KG'),
    ('303c8f86-1d48-4b0c-bddb-fa8efe4b96b2'::uuid, '07KD12-SCA không đường VNM 100G', '07KD12', 'SCA không đường VNM 100G'),
    ('86901d80-c4b5-408f-8be6-ecb0665058b8'::uuid, '07NC15-SCA nếp cẩm VNM 100G (24h/t)', '07NC15', 'SCA nếp cẩm VNM 100G (24h/t)'),
    ('14302680-8657-4935-8e36-a0b105d84656'::uuid, '07nh12-sữa CHUA NHA đam ít đường VINAMILK 100G', '07NH12', 'Sữa CHUA NHA đam ít đường VINAMILK 100G'),
    ('a7d02241-0d99-4d27-b50c-e62533fbf7dc'::uuid, '07SR11 SCA có đường STAR 100G', '07SR11', 'SCA có đường STAR 100G'),
    ('0e5926dd-9164-4eb8-9fc0-ae174f0dd5eb'::uuid, '07SR11-SCA có đường STAR 100G', '07SR11', 'SCA có đường STAR 100G'),
    ('58b1be4e-a3ce-4c17-b913-a23b506a4344'::uuid, '07UR13-SCU MS vị truyền thống VNM PROBI 65ML', '07UR13', 'SCU MS vị truyền thống VNM PROBI 65ML'),
    ('5b2750a1-e157-4e20-b28c-13f6a8e86c9a'::uuid, '07UR31-SCU MS vị truyền thống VNM PROBI 130ML', '07UR31', 'SCU MS vị truyền thống VNM PROBI 130ML')
)
UPDATE public.products p
SET product_code = x.product_code,
    product_name = x.clean_name
FROM planned x
WHERE p.id = x.product_id
  AND p.product_name = x.old_name
  AND p.product_code IS NULL;
