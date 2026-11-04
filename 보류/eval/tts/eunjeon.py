# g2pkk는 Windows에서 eunjeon만 찾는다. eunjeon은 C++ 빌드가 필요해, 리눅스 경로와 같은 python-mecab-ko로 연결한다.
from mecab import MeCab


class Mecab:
    def __init__(self):
        self._m = MeCab()

    def pos(self, text):
        return self._m.pos(text)
