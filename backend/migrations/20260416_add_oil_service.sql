-- ✅ Ajouter table oil_models pour Service à Domicile
CREATE TABLE IF NOT EXISTS oil_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ✅ Ajouter colonnes requests pour Service à Domicile
ALTER TABLE requests ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100) DEFAULT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS oil_liters INT DEFAULT NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS oil_model_id INT DEFAULT NULL;

-- ✅ FK pour oil_model_id
ALTER TABLE requests ADD CONSTRAINT IF NOT EXISTS fk_oil_model
  FOREIGN KEY (oil_model_id) REFERENCES oil_models(id) ON DELETE SET NULL;

-- ✅ Seed modèles d'huile courants
INSERT IGNORE INTO oil_models (name, description, is_active) VALUES
('Castrol Activ 10W-40', 'Huile semi-synthétique 10W-40', 1),
('Mobil Super 3000 10W-40', 'Huile semi-synthétique 10W-40', 1),
('Total Quartz 7000 10W-40', 'Huile semi-synthétique 10W-40', 1),
('ELF Evolution 10W-40', 'Huile semi-synthétique 10W-40', 1),
('Shell Helix HX7 10W-40', 'Huile semi-synthétique 10W-40', 1),
('Castrol Magnatec 5W-40', 'Huile semi-synthétique 5W-40', 1),
('Mobil 1 0W-20', 'Huile synthétique 0W-20', 1),
('Total Quartz Ineo 5W-30', 'Huile synthétique 5W-30', 1);
