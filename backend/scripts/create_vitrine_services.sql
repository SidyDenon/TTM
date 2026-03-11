-- Create a dedicated table for website showcase services.
-- This keeps vitrine services independent from app services (table: services).

CREATE TABLE IF NOT EXISTS vitrine_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  icon_url VARCHAR(255) NULL,
  icon VARCHAR(120) NULL,
  image_url VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Optional one-time seed from app services (only if vitrine table is empty).
INSERT INTO vitrine_services (name, subtitle, description, price, icon_url, icon, image_url, is_active)
SELECT
  s.name,
  NULL,
  s.description,
  s.price,
  CASE
    WHEN s.icon_url IS NOT NULL THEN s.icon_url
    ELSE NULL
  END AS icon_url,
  CASE
    WHEN s.icon IS NOT NULL THEN s.icon
    ELSE NULL
  END AS icon,
  NULL,
  1
FROM services s
WHERE NOT EXISTS (SELECT 1 FROM vitrine_services LIMIT 1);

