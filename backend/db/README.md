# Database Import

Place the production MySQL/MariaDB export at:

```text
db/focal_db.sql
```

Import it from the OCI VM:

```bash
MYSQL_HOST=<mysql-private-ip> \
MYSQL_USER=<db-user> \
MYSQL_PASSWORD=<db-password> \
MYSQL_DATABASE=focal_db \
SQL_FILE=db/focal_db.sql \
sh deploy/import-sql.sh
```

The backend uses MySQL Connector/J, so the OCI Free Tier database should be MySQL HeatWave, not Oracle Autonomous Database, unless the backend is migrated to Oracle JDBC and Oracle SQL syntax.
