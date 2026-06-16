"""
HDFS Parquet Reader for AURORA Analytics Engine.
Reads aggregated Parquet data from the data lake.
"""

import os
from pathlib import Path
from typing import Optional

import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.fs as pafs

HDFS_NAMENODE = os.getenv("HDFS_NAMENODE", "namenode")
HDFS_PORT = int(os.getenv("HDFS_PORT", "8020"))
HDFS_USER = os.getenv("HDFS_USER", "root")

_fs: Optional[pafs.HadoopFileSystem] = None


def get_hdfs_fs() -> pafs.HadoopFileSystem:
    """Get or create HDFS filesystem connection."""
    global _fs
    if _fs is None:
        _fs = pafs.HadoopFileSystem(
            host=HDFS_NAMENODE,
            port=HDFS_PORT,
            user=HDFS_USER,
        )
    return _fs


def read_parquet(hdfs_path: str) -> pa.Table:
    """Read a single Parquet file or directory from HDFS."""
    fs = get_hdfs_fs()
    info = fs.get_file_info(hdfs_path)
    if info.type == pa.fs.FileType.Directory:
        # Read all parquet files in directory
        dataset = pq.ParquetDataset(hdfs_path, filesystem=fs)
        return dataset.read()
    else:
        return pq.read_table(hdfs_path, filesystem=fs)


def read_tps_volume_raw(limit_minutes: int = 30) -> Optional[pa.Table]:
    """Read raw TPS volume events."""
    try:
        return read_parquet("hdfs://namenode:8020/aurora/raw/tps_volume/")
    except Exception:
        return None


def read_tps_by_kecamatan() -> Optional[pa.Table]:
    """Read aggregated TPS volume by kecamatan."""
    try:
        return read_parquet("hdfs://namenode:8020/aurora/aggregated/tps_volume_by_kecamatan/")
    except Exception:
        return None


def read_tps_by_waste_type() -> Optional[pa.Table]:
    """Read aggregated waste type distribution."""
    try:
        return read_parquet("hdfs://namenode:8020/aurora/aggregated/tps_volume_by_waste_type/")
    except Exception:
        return None


def read_critical_tps() -> Optional[pa.Table]:
    """Read critical TPS records (fill_level >= 0.9)."""
    try:
        return read_parquet("hdfs://namenode:8020/aurora/aggregated/tps_critical/")
    except Exception:
        return None


def read_event_type_distribution() -> Optional[pa.Table]:
    """Read event type distribution."""
    try:
        return read_parquet("hdfs://namenode:8020/aurora/aggregated/event_type_distribution/")
    except Exception:
        return None
