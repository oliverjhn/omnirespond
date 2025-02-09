import logging
import time
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

# ANSI escape codes for bold and reset
BOLD = "\033[1m"
RESET = "\033[0m"


def log_timing(func):
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            result = await func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            logger.info(
                f"{BOLD}{func.__name__}{RESET} took {BOLD}{elapsed:.2f}s{RESET}"
            )
            return result
        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(
                f"{BOLD}{func.__name__}{RESET} failed after {BOLD}{elapsed:.2f}s{RESET}: {str(e)}"
            )
            raise

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            logger.info(
                f"{BOLD}{func.__name__}{RESET} took {BOLD}{elapsed:.2f}s{RESET}"
            )
            return result
        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(
                f"{BOLD}{func.__name__}{RESET} failed after {BOLD}{elapsed:.2f}s{RESET}: {str(e)}"
            )
            raise

    return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper


class BaseService:
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
