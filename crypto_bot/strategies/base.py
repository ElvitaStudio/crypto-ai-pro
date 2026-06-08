# -*- coding: utf-8 -*-
from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    """
    All strategies implement run_scan(symbols) and return a list of signal dicts.
    A signal dict must contain:
        symbol, direction, entry, sl, tp, message, chart_buf (bytes | None)
    Optional keys: features (dict for ML logging)
    """

    @abstractmethod
    def run_scan(self, symbols: list[str]) -> list[dict]:
        ...
