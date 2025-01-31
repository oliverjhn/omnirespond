from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)

class BaseService:
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
