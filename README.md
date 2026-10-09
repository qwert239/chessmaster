# chessmaster

체스 기보를 저장하고, 그 사람이 둔 나쁜 수를 찾아 봐서 복습할 수 있는 앱입니다.

배포 주소: https://gcx6o4a8ia.execute-api.ap-northeast-2.amazonaws.com

PGN은 체스 한 판을 글로 적은 것입니다. 체스 사이트에서 복사할 수 있는 텍스트이고, 누가 백과 흑이었는지와 둔 수가 들어 있습니다.

Stockfish는 체스 프로그램입니다. 각 장면에서 누가 얼마나 유리한지 점수로 알려 줍니다. 양수는 백이 유리하고, 음수는 흑이 유리합니다. `+#3`은 백이 3수 안에 체크메이트할 수 있다는 뜻입니다.

## 사용법

### 기보 불러오기

![메인 페이지](docs/main.jpg)

1. PGN을 붙여 넣고 `Load`를 누릅니다. 아직 저장되지 않습니다.
2. 보드 아래 버튼이나 좌우 화살표로 수를 이동합니다. 각 수의 점수는 수 오른쪽에 나옵니다.
3. `Evaluate`로 Stockfish 평가를 돌립니다.
4. 평가가 끝나면 `Save`를 누릅니다. 평가 전에 저장하면 실수 목록에 나오지 않습니다.

### 실수 보기

오른쪽 위 `See your mistakes`로 이동합니다.

![실수 페이지](docs/mistakes.jpg)

1. **Name**에 기보에 적힌 백 또는 흑 이름을 입력합니다.
2. Inaccuracies, Mistakes, Blunders 중 하나를 고르고 `Show`를 누릅니다.
3. 게임별로 둔 수(Move), 그 수 이후의 점수(Eval), 더 나은 수(Best Move)를 볼 수 있습니다.
4. `Show board`는 그 수를 두기 전 장면입니다. 빨간 화살표는 둔 수, 초록 화살표는 더 나은 수입니다.

나쁜 수는 승률이 얼마나 줄었는지로 정합니다. 승률이 조금 줄면 Inaccuracy, 더 줄면 Mistake, 크게 줄면 Blunder입니다.

## 스택

브라우저는 보드와 Stockfish를 담당합니다. 서버는 NestJS이고, 데이터베이스는 Postgres입니다. 로컬은 `.env`의 `DATABASE_URL`을 읽고, Lambda는 SAM이 RDS 주소와 비밀번호로 만든 `DATABASE_URL`을 읽습니다.

```text
브라우저 (보드, Stockfish)
        |  POST /games , GET /mistakes
        v
NestJS  ---- 로컬 ----> 로컬 Postgres
        ---- Lambda --> RDS Postgres
```

`POST /games`는 기보와 평가를 저장합니다. `GET /mistakes?name=&verdict=`는 그 이름이 둔 나쁜 수만 게임별로 돌려줍니다. 데이터베이스에서 `games`는 기보 하나, `moves`는 그 안의 한 수입니다.

로컬 실행:

```bash
npm install
psql "postgresql://USER:PASSWORD@localhost:5432/chessmaster" -f db/schema.sql
npm run start:dev
```

`.env`에는 `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/chessmaster`를 넣습니다. 이 파일은 커밋하지 않습니다. 앱은 http://localhost:3000 입니다.

배포는 `sam build` 다음 `sam deploy`입니다. 데이터베이스 비밀번호는 스택을 처음 만들 때 넘깁니다.

```bash
sam deploy --parameter-overrides "DbPassword=YOUR_PASSWORD"
```

이후 배포는 그 값을 유지하므로 `DbPassword` 없이 `sam deploy`만 하면 됩니다. 데이터베이스 수정은 RDS 포트 5432를 내 IP에만 여는 규칙을 추가한 뒤 PC에서 쿼리를 실행하고, 규칙을 지우면 됩니다.

Stockfish 파일(`public/engine/`)은 [stockfish.js](https://github.com/nmrugg/stockfish.js) 19이며 GPLv3입니다.
