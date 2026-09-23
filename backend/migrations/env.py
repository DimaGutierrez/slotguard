from alembic import context

from slotguard.db import make_engine

engine = make_engine()
with engine.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
