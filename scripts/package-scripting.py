"""Build the importable Scripting project; no private widget keys are included."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_STORED

root = Path(__file__).resolve().parent.parent
files = sorted((root / 'widgets/scripting').iterdir())
target = root / 'public/JP7-ToDo.scripting'
with ZipFile(target, 'w', compression=ZIP_STORED) as archive:
    for source in files:
        entry = ZipInfo(source.name, date_time=(2020, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_STORED
        archive.writestr(entry, source.read_bytes())
# Older import menus accept the standard .zip extension too.
(root / 'public/JP7-ToDo.zip').write_bytes(target.read_bytes())
