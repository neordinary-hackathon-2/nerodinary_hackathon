# 0001. DB는 Lightsail 관리형 MySQL이 아니라 RDS MySQL을 쓴다

- 상태: 결정됨 (2026-11-21)
- 결정자: sychoi
- 범위: 11th Ne(o)rdinary 해커톤 서버 인프라. 서비스 유지 시간은 24시간 이내.

## 배경

WAS는 Lightsail 인스턴스로 정해져 있다. DB를 같은 Lightsail의 관리형 MySQL로 둘지, RDS MySQL로 둘지 정해야 했다.
심사 기준(인프라 30점) 중 DB와 관련된 항목은 WAS/DB 분리 5점, DB 포트 외부 비노출 2점, 불필요한 포트 비공개(방화벽·보안그룹) 3점, 구성·ERD 설계 10점이다.

## 결정

RDS MySQL 8.4, `db.t4g.micro`, 단일 AZ, 20GB, 퍼블릭 액세스 없음.
Lightsail과는 VPC 피어링으로 연결하고, RDS 보안그룹에서 3306을 Lightsail 인스턴스의 사설 IP만 허용한다.

## 비교

| | RDS MySQL (db.t4g.micro) | Lightsail 관리형 MySQL (1GB Standard) |
|---|---|---|
| 요금(서울) | 시간당 $0.025 + 스토리지 $0.131/GB월. 24시간 약 $0.7 | 시간당 $0.0202(40GB 포함). 24시간 약 $0.5 |
| 위치 | 기본 VPC | Lightsail 내부망 |
| Lightsail 인스턴스와 연결 | VPC 피어링 필요 | 추가 설정 없음 |
| 접근 차단 수단 | 퍼블릭 액세스 off + 보안그룹 | 퍼블릭 모드 off (보안그룹 없음) |
| 계정에 생기는 변경 | 기본 VPC 라우트 테이블에 피어링 경로 추가, 보안그룹 1개 | 기본 VPC를 건드리지 않음 |
| 필요한 IAM 권한 | Lightsail + RDS + EC2(보안그룹) | Lightsail만 |
| 저장 암호화 | 켤 수 있음(추가 요금 없음) | 요금 페이지에 Standard 플랜은 "No Data encryption" |
| 애플리케이션 코드 | 수정 없음 (`.env.production`의 접속 정보만 다름) | 수정 없음. 단 TLS 강제 여부 미확인 |

## 선택 기준

1. **심사에서 보여줄 근거.** 두 안 모두 WAS/DB 분리와 DB 포트 비노출은 충족한다. RDS는 "보안그룹에서 3306을 인스턴스 사설 IP만 허용"이라는 규칙을 구성도에 적을 수 있어, 방화벽·보안그룹 항목과 설계 항목에서 설명할 근거가 더 분명하다. Lightsail DB는 "퍼블릭 모드 off" 한 줄이 전부다.
2. **확인된 동작이 더 많다.** RDS는 MySQL 8.4.13까지 선택 가능하고 `db.t4g.micro`가 서울 4개 AZ에서 주문 가능함을 조회로 확인했다. 8.4의 `require_secure_transport` 기본값이 0(TLS 비강제)이라 현재 DB 연결 설정 그대로 붙는다는 것도 문서로 확인했다. Lightsail DB는 제공 버전과 TLS 강제 여부를 확인하지 못했고, TLS가 강제돼 있으면 코드 수정이 필요해진다.
3. **이미 정한 구성과 일치.** README의 구성도와 배포 절이 RDS + VPC 피어링 기준으로 작성돼 있다.
4. **비용은 기준이 아니다.** 24시간 기준 차이가 약 $0.2다.

## 감수하는 것

- 작업 단계가 늘어난다: VPC 피어링 활성화, 보안그룹 생성, 필요한 IAM 권한이 Lightsail 외에 RDS·EC2까지 넓어진다.
- 기본 VPC의 메인 라우트 테이블에 피어링 경로가 추가된다. 다른 자원이 도는 계정에 만들 경우 그 계정의 공유 네트워크 설정을 바꾸는 것이다. 어느 AWS 계정에 만들지는 이 문서 작성 시점에 확정되지 않았다.
- 앱과 DB 사이 구간은 TLS 없이 AWS 사설망(피어링)으로 통신한다.

## 버전 선택 메모

MySQL 8.0은 RDS 표준 지원이 2026-07-31에 끝나 Extended Support 요금(서울, vCPU당 시간당 $0.12)이 붙는다. 그래서 8.4를 쓴다.

## 근거 출처와 미확인 항목

확인한 것 (2026-11-21):

- 요금: AWS 공개 Price List(`AmazonRDS`, `AmazonLightsail`, ap-northeast-2).
- RDS 엔진 버전과 주문 가능 클래스: `aws rds describe-db-engine-versions`, `describe-orderable-db-instance-options`.
- MySQL 8.0/8.4 지원 종료일, `require_secure_transport` 기본값: Amazon RDS User Guide.
- Lightsail 피어링은 같은 리전의 기본 VPC와만 가능: Lightsail User Guide.

확인하지 못한 것:

- Lightsail 관리형 MySQL의 제공 버전과 TLS 강제 여부.
- Lightsail 쪽 사설 대역 CIDR. 문서에 명시가 없어, 인스턴스 생성 후 사설 IP를 조회해 보안그룹에 넣는다.
- 피어링 시 기본 VPC 라우트 테이블이 자동으로 구성되는지. 생성 후 라우트 테이블 조회와 인스턴스에서의 3306 접속으로 확인한다.
- 프리 티어 적용 여부. 계정이 확정돼야 알 수 있다.

## 다시 검토할 조건

- 인프라를 만들 계정에서 기본 VPC 변경이나 RDS·EC2 권한 확보가 불가능한 경우 → Lightsail 관리형 MySQL로 전환.
