"""Script de migração: Google Sheets → Supabase.

Uso:
    python scripts/migrate_sheets_to_supabase.py

Requer variáveis de ambiente:
    SUPABASE_URL, SUPABASE_KEY
    (ou st.secrets configurado em .streamlit/secrets.toml)

O script lê dados do Google Sheets via streamlit_gsheets e insere no Supabase.
Deve ser executado manualmente com validação humana.
"""
from __future__ import annotations

import sys
import os
import logging
from datetime import datetime

# Adicionar raiz do projeto ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("migration")


def migrate():
    """Executa migração completa."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        logger.error("Configure SUPABASE_URL e SUPABASE_KEY como variáveis de ambiente.")
        sys.exit(1)

    client = create_client(url, key)
    logger.info(f"Supabase conectado: {url[:40]}...")

    # Importar SheetsRepository requer mock do streamlit
    from unittest.mock import MagicMock
    mock_st = MagicMock()
    mock_st.secrets = MagicMock()
    mock_st.secrets.get = MagicMock(return_value={})
    mock_st.session_state = {}
    mock_st.cache_data = MagicMock()
    sys.modules["streamlit"] = mock_st
    sys.modules["streamlit.components"] = MagicMock()
    sys.modules["streamlit.components.v1"] = MagicMock()
    sys.modules["streamlit_gsheets"] = MagicMock()

    from core.supabase_repository import SupabaseRepository, _to_snake
    from core.config import CFG

    repo = SupabaseRepository(client=client)

    # Mapeamento de tabelas e colunas PascalCase → snake_case
    tables = {
        "transacoes": {
            "cols": list(CFG.COLS_TRANSACAO),
            "has_text_id": True,
        },
        "patrimonio": {
            "cols": list(CFG.COLS_PATRIMONIO),
            "has_text_id": False,
        },
        "recorrentes": {
            "cols": list(CFG.COLS_RECORRENTE),
            "has_text_id": False,
        },
        "orcamentos": {
            "cols": list(CFG.COLS_ORCAMENTO),
            "has_text_id": False,
        },
        "configuracoes": {
            "cols": list(CFG.COLS_CONFIG),
            "has_text_id": False,
        },
        "audit_log": {
            "cols": list(CFG.COLS_AUDIT),
            "has_text_id": False,
        },
        "metas": {
            "cols": list(CFG.COLS_METAS),
            "has_text_id": True,
        },
        "passivos": {
            "cols": list(CFG.COLS_PASSIVOS),
            "has_text_id": False,
        },
        "lixeira": {
            "cols": list(CFG.COLS_LIXEIRA),
            "has_text_id": True,
        },
        "favoritos": {
            "cols": list(CFG.COLS_FAVORITOS),
            "has_text_id": True,
        },
    }

    logger.info("=" * 60)
    logger.info("MIGRAÇÃO: Google Sheets → Supabase")
    logger.info("=" * 60)

    # Este script lê CSVs exportados ou dados já no formato DataFrame
    # Para migração real, o usuário deve:
    # 1. Exportar cada worksheet como CSV
    # 2. Colocar na pasta scripts/data/
    # 3. Ou ajustar este script para ler diretamente do Google Sheets

    import pandas as pd
    from core.supabase_repository import _COL_MAP

    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
        logger.warning(f"Pasta {data_dir} criada. Coloque CSVs exportados do Google Sheets aqui.")
        logger.info("Nomes esperados: Transacoes.csv, Patrimonio.csv, Recorrentes.csv, etc.")
        logger.info("Abortando. Re-execute após colocar os CSVs.")
        return

    ws_name_map = {
        "transacoes": "Transacoes",
        "patrimonio": "Patrimonio",
        "recorrentes": "Recorrentes",
        "orcamentos": "Orcamentos",
        "configuracoes": "Configuracoes",
        "audit_log": "AuditLog",
        "metas": "Metas",
        "passivos": "Passivos",
        "lixeira": "Lixeira",
        "favoritos": "Favoritos",
    }

    summary = []

    for sb_table, info in tables.items():
        ws_name = ws_name_map[sb_table]
        csv_path = os.path.join(data_dir, f"{ws_name}.csv")

        if not os.path.exists(csv_path):
            logger.warning(f"[SKIP] {ws_name}.csv não encontrado")
            summary.append((sb_table, 0, 0, "SKIPPED"))
            continue

        logger.info(f"\n--- Migrando {ws_name} → {sb_table} ---")

        try:
            df = pd.read_csv(csv_path)
            df = df.dropna(how="all")
            source_count = len(df)
            logger.info(f"  Lido: {source_count} registros")

            if df.empty:
                summary.append((sb_table, 0, 0, "EMPTY"))
                continue

            # Rename to snake_case
            df_snake = df.rename(columns={k: v for k, v in _COL_MAP.items() if k in df.columns})

            # Convert to records
            records = df_snake.to_dict("records")

            # Clean NaN
            for rec in records:
                for k, v in list(rec.items()):
                    if pd.isna(v):
                        rec[k] = None

            # Batch insert
            batch_size = 500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                client.table(sb_table).upsert(batch).execute()
                logger.info(f"  Inserido batch {i // batch_size + 1}: {len(batch)} registros")

            # Validate count
            result = client.table(sb_table).select("*", count="exact").execute()
            dest_count = result.count or len(result.data)
            status = "OK" if dest_count >= source_count else "MISMATCH"
            logger.info(f"  Resultado: {source_count} fonte → {dest_count} destino [{status}]")
            summary.append((sb_table, source_count, dest_count, status))

        except Exception as e:
            logger.error(f"  ERRO em {sb_table}: {e}")
            summary.append((sb_table, 0, 0, f"ERROR: {e}"))

    # Relatório final
    logger.info("\n" + "=" * 60)
    logger.info("RELATÓRIO FINAL")
    logger.info("=" * 60)
    logger.info(f"{'Tabela':<20} {'Fonte':>8} {'Destino':>8} {'Status':<10}")
    logger.info("-" * 50)
    for table, src, dst, status in summary:
        logger.info(f"{table:<20} {src:>8} {dst:>8} {status:<10}")


if __name__ == "__main__":
    migrate()
