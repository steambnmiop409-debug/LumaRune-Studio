export default function EngineOfficialSite() {
  const features = [
    {
      title: "Studio 중심 제작",
      desc: "프로젝트 생성, 편집, 플레이테스트, 빌드까지 한 흐름으로 작업할 수 있는 Studio 기반 제작 환경.",
    },
    {
      title: "C++ Runtime + Python Tools",
      desc: "고성능 런타임은 C++, Studio와 Creator Tools는 Python 중심으로 분리된 구조.",
    },
    {
      title: "2D 픽셀 게임 제작 플랫폼",
      desc: "특정 게임 틀을 강제하지 않고, API와 도구를 제공하는 Roblox 스타일 제작 철학.",
    },
    {
      title: "AI Draft 워크플로우",
      desc: "에셋, 맵, 대사, 음악 초안은 draft 구조로 저장하고 사용자가 선택 적용하는 방식.",
    },
  ];

  const sections = [
    { title: "다운로드", desc: "최신 설치 파일과 버전 정보" },
    { title: "문서", desc: "설치, 시작하기, Studio 사용법" },
    { title: "샘플", desc: "예제 프로젝트와 템플릿" },
    { title: "변경사항", desc: "버전별 업데이트 내역" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold tracking-wide">Engine Studio</div>
            <div className="text-xs text-zinc-400">AI Integrated 2D Pixel Game Platform</div>
          </div>
          <nav className="hidden gap-6 text-sm text-zinc-300 md:flex">
            <a href="#features" className="hover:text-white">기능</a>
            <a href="#download" className="hover:text-white">다운로드</a>
            <a href="#docs" className="hover:text-white">문서</a>
            <a href="#roadmap" className="hover:text-white">로드맵</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-zinc-800">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                초기 공개 사이트 베타
              </div>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                2D 픽셀 게임을 위한
                <br />
                <span className="text-cyan-300">Studio 기반 제작 플랫폼</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Engine Studio는 특정 전투 구조나 세이브 틀을 강제하지 않습니다.
                엔진은 런타임, Studio, Creator Tools, Build 파이프라인을 제공하고,
                게임 시스템 설계는 제작자에게 맡깁니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#download"
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-300/20 transition hover:scale-[1.02]"
                >
                  다운로드 준비중
                </a>
                <a
                  href="#docs"
                  className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  문서 보기
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow-2xl shadow-black/30">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="ml-2">Studio Preview</span>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="mb-2 text-xs font-semibold text-zinc-400">Project</div>
                    <div className="space-y-2 text-sm text-zinc-200">
                      <div className="rounded-lg bg-zinc-800 px-3 py-2">Maps</div>
                      <div className="rounded-lg bg-zinc-800 px-3 py-2">Assets</div>
                      <div className="rounded-lg bg-zinc-800 px-3 py-2">Scripts</div>
                      <div className="rounded-lg bg-zinc-800 px-3 py-2">Templates</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs font-semibold text-zinc-400">Editor</div>
                      <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300">Playtest Ready</div>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-[4px] ${
                            i % 9 === 0
                              ? "bg-cyan-300/80"
                              : i % 7 === 0
                                ? "bg-zinc-600"
                                : "bg-zinc-800"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-10">
            <div className="text-sm font-semibold text-cyan-300">핵심 특징</div>
            <h2 className="mt-2 text-3xl font-bold">엔진이 틀을 강제하지 않는 구조</h2>
            <p className="mt-3 max-w-2xl text-zinc-400">
              완성된 RPG 틀을 제공하는 방식이 아니라, 유저가 원하는 시스템을 직접 설계할 수 있는 제작 플랫폼을 목표로 합니다.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map((item) => (
              <div key={item.title} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg shadow-black/20">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/40">
          <div className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-2 xl:grid-cols-4">
            {sections.map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <div className="text-lg font-semibold">{item.title}</div>
                <div className="mt-2 text-sm text-zinc-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="download" className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="text-sm font-semibold text-cyan-300">다운로드</div>
              <h2 className="mt-2 text-3xl font-bold">배포 페이지 기본 골격</h2>
              <p className="mt-4 max-w-2xl text-zinc-400">
                지금은 사이트를 먼저 활성화하는 단계이므로, 다운로드 버튼은 임시 링크 또는 준비중 상태로 연결해도 충분합니다.
                나중에 Setup.exe와 버전 정보, 릴리스 노트를 여기에 연결하면 됩니다.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="text-sm text-zinc-400">최신 버전</div>
              <div className="mt-2 text-2xl font-bold">v0.1.0-beta</div>
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                Windows x64 · 설치 파일 준비중
              </div>
              <button className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-zinc-950 transition hover:scale-[1.01]">
                다운로드 예정
              </button>
              <div className="mt-3 text-xs text-zinc-500">
                추후 GitHub Releases 또는 공식 배포 저장소 링크 연결
              </div>
            </div>
          </div>
        </section>

        <section id="docs" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-8">
            <div className="text-sm font-semibold text-cyan-300">문서</div>
            <h2 className="mt-2 text-3xl font-bold">처음 공개할 문서 섹션</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["설치 가이드", "설치 파일 다운로드, 설치, 첫 실행 흐름 정리"],
              ["첫 프로젝트 만들기", "Blank Project와 템플릿 기반 시작 방법"],
              ["Studio 사용법", "프로젝트 열기, 리소스 관리, 플레이테스트"],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                <div className="text-lg font-semibold">{title}</div>
                <div className="mt-3 text-sm leading-6 text-zinc-400">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="roadmap" className="border-t border-zinc-800 bg-zinc-900/40">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="text-sm font-semibold text-cyan-300">로드맵</div>
            <h2 className="mt-2 text-3xl font-bold">현재 공개 가능한 개발 방향</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                "C++ Runtime 초기 안정화",
                "Studio 기본 UI 및 프로젝트 관리",
                "플레이테스트 흐름 고정",
                "다운로드 패키지 및 공식 배포 구조",
              ].map((item, idx) => (
                <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="text-xs text-cyan-300">0{idx + 1}</div>
                  <div className="mt-2 font-semibold">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <div>© 2026 Engine Studio. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#download" className="hover:text-zinc-300">Download</a>
            <a href="#docs" className="hover:text-zinc-300">Docs</a>
            <a href="#roadmap" className="hover:text-zinc-300">Roadmap</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
