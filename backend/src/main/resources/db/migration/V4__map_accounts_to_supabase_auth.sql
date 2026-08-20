ALTER TABLE account
    ADD COLUMN auth_subject uuid;

ALTER TABLE account
    ALTER COLUMN username DROP NOT NULL,
    ALTER COLUMN normalized_username DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE account
    ADD CONSTRAINT uq_account_auth_subject UNIQUE (auth_subject);
