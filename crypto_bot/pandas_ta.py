# -*- coding: utf-8 -*-
"""
pandas_ta compatibility shim — maps pandas_ta API onto the `ta` library.
Only the functions actually used by the strategies are implemented here.
"""
import pandas as pd
import ta as _ta


def rsi(series: pd.Series, length: int = 14) -> pd.Series:
    return _ta.momentum.rsi(series, window=length)


def ema(series: pd.Series, length: int = 20) -> pd.Series:
    return _ta.trend.ema_indicator(series, window=length)


def adx(high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14) -> pd.DataFrame:
    adx_val = _ta.trend.adx(high, low, close, window=length)
    return pd.DataFrame({f"ADX_{length}": adx_val})


def bbands(series: pd.Series, length: int = 20, std: float = 2.0) -> pd.DataFrame:
    bb = _ta.volatility.BollingerBands(series, window=length, window_dev=std)
    return pd.DataFrame({
        f"BBU_{length}_{std}": bb.bollinger_hband(),
        f"BBM_{length}_{std}": bb.bollinger_mavg(),
        f"BBL_{length}_{std}": bb.bollinger_lband(),
    })


def linreg(series: pd.Series, length: int = 20) -> pd.Series:
    """Rolling linear regression — returns predicted value at each window end."""
    import numpy as np

    def _lr(arr: pd.Series) -> float:
        x = np.arange(len(arr))
        if arr.isna().any():
            return float("nan")
        m, b = np.polyfit(x, arr.values, 1)
        return float(m * x[-1] + b)

    return series.rolling(length).apply(_lr, raw=False)


def stdev(series: pd.Series, length: int = 20) -> pd.Series:
    return series.rolling(length).std(ddof=0)


def vwap(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    volume: pd.Series,
    **kwargs,
) -> pd.Series:
    typical = (high + low + close) / 3
    cum_vol = volume.cumsum()
    cum_tpv = (typical * volume).cumsum()
    result = cum_tpv / cum_vol.replace(0, float("nan"))
    result.name = "VWAP_D"
    return result


# ── DataFrame accessor (df.ta.vwap) ──────────────────────────────────────────

@pd.api.extensions.register_dataframe_accessor("ta")
class _TaAccessor:
    def __init__(self, obj: pd.DataFrame) -> None:
        self._df = obj

    def vwap(self, append: bool = False) -> pd.Series:
        result = vwap(
            self._df["high"],
            self._df["low"],
            self._df["close"],
            self._df["volume"],
        )
        if append:
            self._df["VWAP_D"] = result
        return result
