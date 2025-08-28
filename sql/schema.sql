-- schema.sql (versi Hostinger)
-- Jalankan saat database u634916118_db_kontak_adv sudah dipilih.

CREATE TABLE IF NOT EXISTS kontak_pegawai (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nip VARCHAR(50) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  bidang VARCHAR(100) NOT NULL,
  no_telp VARCHAR(30) NOT NULL,
  email VARCHAR(100) NOT NULL,
  alamat TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
