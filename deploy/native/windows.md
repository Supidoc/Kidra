# Running Kidra natively on Windows

The Windows release archive (`kidra_<version>_windows_amd64.zip`) contains
`kidra.exe` and a `pb_migrations\` folder. The web UI is embedded in the binary.

## 1. Unpack

Unpack the archive to e.g. `C:\Program Files\Kidra\`. Keep `pb_migrations\` next
to `kidra.exe`: Kidra looks for its migrations in `<folder of kidra.exe>\pb_migrations`
(override with `KIDRA_MIGRATIONS_DIR`).

```
C:\Program Files\Kidra\
├─ kidra.exe
└─ pb_migrations\
```

Pick a data directory that is writable by the account the service runs as, e.g.
`C:\ProgramData\Kidra`.

## 2. Configure (`kidra.env`)

Kidra reads a dotenv file named `kidra.env` from its data directory
(`--dir`), or the file named in `KIDRA_ENV_FILE`. Variables that are already set
in the environment win. Create `C:\ProgramData\Kidra\kidra.env`:

```ini
KIDRA_LIBRARY_REPO=https://github.com/<you>/<libraries>.git
KIDRA_LIBRARY_PULL_CRON=*/15 * * * *
KIDRA_APP_URL=http://kidra-pc:8090
KIDRA_KICAD_CLI=C:\Program Files\KiCad\10.0\bin\kicad-cli.exe
KIDRA_ADMIN_EMAIL=admin@example.com
KIDRA_ADMIN_PASSWORD=change-me-to-a-long-random-password
```

kicad-cli is optional. Without it Kidra runs normally and shows
"No preview available" instead of SVG previews. With KiCad 10 installed in the
default location, point `KIDRA_KICAD_CLI` at
`C:\Program Files\KiCad\10.0\bin\kicad-cli.exe` as shown above. The library sync
uses `git`, so install [Git for Windows](https://git-scm.com/download/win) and
make sure it is on the `PATH` of the service account.

Restrict access to `kidra.env`, because it holds the admin password: only
Administrators, SYSTEM and the service account should be able to read it.

## 3. Try it in a terminal

```powershell
cd "C:\Program Files\Kidra"
.\kidra.exe serve --http=0.0.0.0:8090 --dir=C:\ProgramData\Kidra
```

Open http://localhost:8090. Stop with Ctrl+C.

## 4. Install as a Windows service

Use either NSSM or WinSW.

### NSSM

```powershell
nssm install Kidra "C:\Program Files\Kidra\kidra.exe" serve --http=0.0.0.0:8090 --dir=C:\ProgramData\Kidra
nssm set Kidra AppDirectory "C:\Program Files\Kidra"
nssm set Kidra AppStdout C:\ProgramData\Kidra\service.log
nssm set Kidra AppStderr C:\ProgramData\Kidra\service.log
nssm set Kidra AppRotateFiles 1
nssm set Kidra AppRotateBytes 10485760
nssm set Kidra Start SERVICE_AUTO_START
nssm start Kidra
```

### WinSW

Put `WinSW-x64.exe` next to `kidra.exe`, rename it to `kidra-service.exe`, and
create `kidra-service.xml` next to it:

```xml
<service>
  <id>Kidra</id>
  <name>Kidra</name>
  <description>Kidra KiCad part library manager</description>
  <executable>%BASE%\kidra.exe</executable>
  <arguments>serve --http=0.0.0.0:8090 --dir=C:\ProgramData\Kidra</arguments>
  <workingdirectory>%BASE%</workingdirectory>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="10 sec"/>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
</service>
```

```powershell
.\kidra-service.exe install
.\kidra-service.exe start
```

Both run the service as LocalSystem by default. To use a dedicated account,
give it write access to `C:\ProgramData\Kidra` and set it in the service
properties (`services.msc`, Log On tab).

## 5. Firewall

`--http=0.0.0.0:8090` listens on all interfaces. To reach Kidra from other
machines on the LAN, allow the port for private networks only:

```powershell
New-NetFirewallRule -DisplayName "Kidra" -Direction Inbound -Protocol TCP -LocalPort 8090 -Action Allow -Profile Private
```

If a reverse proxy runs on the same machine, use `--http=127.0.0.1:8090`
instead and do not open the port. See `deploy/proxy/` for nginx and Caddy
configurations.

## Updating

Stop the service, replace `kidra.exe` and the whole `pb_migrations\` folder with
the new release, and start the service again. New migrations run on start.
PocketBase keeps nightly backups in `C:\ProgramData\Kidra\backups`.
