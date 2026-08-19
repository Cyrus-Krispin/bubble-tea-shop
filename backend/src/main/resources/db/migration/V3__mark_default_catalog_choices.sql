ALTER TABLE option_choice
    ADD COLUMN is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX uq_option_choice_default_group
    ON option_choice (option_group_id)
    WHERE is_default AND archived_at IS NULL;

UPDATE option_choice
   SET is_default = true,
       updated_at = now()
 WHERE id IN (
    '71000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000007'
 );
