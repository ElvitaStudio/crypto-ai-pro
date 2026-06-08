# -*- coding: utf-8 -*-
import io
import warnings
import numpy as np
import pandas as pd
import mplfinance as mpf

warnings.filterwarnings("ignore")


def _base_plot(df: pd.DataFrame, title: str, add_plots: list, hlines_dict: dict | None, buf: io.BytesIO) -> None:
    kwargs = dict(
        type="candle",
        style="yahoo",
        volume=True,
        title=title,
        savefig=dict(fname=buf, dpi=100, bbox_inches="tight"),
    )
    if add_plots:
        kwargs["addplot"] = add_plots
    if hlines_dict:
        kwargs["hlines"] = hlines_dict
    mpf.plot(df, **kwargs)


def _entry_marker(df: pd.DataFrame, direction: str) -> object:
    pts = [np.nan] * len(df)
    if direction == "LONG":
        pts[-1] = df["low"].iloc[-1] * 0.998
        return mpf.make_addplot(pts, type="scatter", markersize=150, marker="^", color="lime")
    else:
        pts[-1] = df["high"].iloc[-1] * 1.002
        return mpf.make_addplot(pts, type="scatter", markersize=150, marker="v", color="fuchsia")


def chart_hline(
    symbol: str,
    df: pd.DataFrame,
    level: float,
    direction: str,
    timeframe: str,
    tail: int = 60,
) -> io.BytesIO | None:
    try:
        plot_df = df.tail(tail).copy()
        buf = io.BytesIO()
        hlines = dict(hlines=[level], colors=["blue"], linewidths=[1.5], alpha=0.8, linestyle="-")
        add_plots = [_entry_marker(plot_df, direction)]
        _base_plot(plot_df, f"\n{symbol} ({timeframe})", add_plots, hlines, buf)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"chart_hline error {symbol}: {e}")
        return None


def chart_channel(
    symbol: str,
    df: pd.DataFrame,
    direction: str,
    timeframe: str,
    tail: int = 60,
) -> io.BytesIO | None:
    """Chart with VWAP + LinReg channel overlays."""
    try:
        plot_df = df.tail(tail).copy()
        buf = io.BytesIO()
        add_plots = [
            mpf.make_addplot(plot_df["vwap"], color="gold", width=1.5),
            mpf.make_addplot(plot_df["upper"], color="red", width=0.8, linestyle="--"),
            mpf.make_addplot(plot_df["lower"], color="green", width=0.8, linestyle="--"),
            mpf.make_addplot(plot_df["linreg"], color="gray", width=0.5),
            _entry_marker(plot_df, direction),
        ]
        _base_plot(plot_df, f"\n{symbol} NEXUS CHANNEL ({direction})", add_plots, None, buf)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"chart_channel error {symbol}: {e}")
        return None


def chart_simple(
    symbol: str,
    df: pd.DataFrame,
    timeframe: str,
    tail: int = 80,
) -> io.BytesIO | None:
    """Plain candlestick chart, no overlays."""
    try:
        plot_df = df.tail(tail).copy()
        buf = io.BytesIO()
        _base_plot(plot_df, f"\n{symbol} ({timeframe})", [], None, buf)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"chart_simple error {symbol}: {e}")
        return None
