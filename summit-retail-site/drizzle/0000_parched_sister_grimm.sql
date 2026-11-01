CREATE TABLE `summit_state` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL
);
