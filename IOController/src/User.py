import datetime

class User(object):
    def __init__(self, personnelId, alias, cardId, allowAccess):
        self._personnelId = personnelId
        self._alias = alias
        self.cardId = cardId
        self._allowAccess = allowAccess
        self.expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=10)

    @property
    def personnelId(self):
        if not self._personnelId:
            return 0
        return self._personnelId

    @property
    def alias(self):
        if not self._alias:
            return ''
        return self._alias

    @property
    def isValidUser(self):
        return self._alias <> None

    @property
    def isExpired(self):
        return self.expiry < datetime.datetime.utcnow()

    @property
    def allowAccess(self):
        return self._allowAccess and self.isValidUser and not self.isExpired