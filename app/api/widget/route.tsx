import { ImageResponse } from 'next/og';
import { GraphQLClient, gql } from 'graphql-request';

const endpoint = 'https://api.github.com/graphql';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');

  if (!username) return new Response('Username required', { status: 400 });

  const token = process.env.GITHUB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { authorization: `Bearer ${token}` },
  });

  const query = gql`
    query ($login: String!) {
      user(login: $login) {
        repositories(first: 100, ownerAffiliations: OWNER) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name color } }
            }
          }
        }
        pinnedItems(first: 3, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              owner { login }
              description
              readme: object(expression: "HEAD:README.md") { ... on Blob { text } }
            }
          }
        }
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { contributionCount date } }
          }
        }
      }
    }
  `;

  try {
    const data: any = await client.request(query, { login: username });
    const user = data.user;

    const langMap: any = {};
    user.repositories.nodes.forEach((repo: any) => {
      repo.languages.edges.forEach((edge: any) => {
        langMap[edge.node.name] = { 
            size: (langMap[edge.node.name]?.size || 0) + edge.size,
            color: edge.node.color 
        };
      });
    });
    const sortedLangs = Object.entries(langMap)
      .map(([name, obj]: any) => ({ name, size: (obj as any).size, color: (obj as any).color }))
      .sort((a, b) => b.size - a.size).slice(0, 5);
    const totalSize = sortedLangs.reduce((acc, curr) => acc + curr.size, 0);

    const allDays = user.contributionsCollection.contributionCalendar.weeks
      .flatMap((w: any) => w.contributionDays)
      .slice(-30);
    
    const maxVal = Math.max(...allDays.map((d: any) => d.contributionCount)) || 1;
    const chartWidth = 700;
    const chartHeight = 200;
    const stepX = chartWidth / (allDays.length - 1);

    const points = allDays.map((d: any, i: number) => ({
      x: i * stepX,
      y: chartHeight - (d.contributionCount / maxVal) * chartHeight,
      val: d.contributionCount,
      day: d.date.split('-')[2] 
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length-1].x} ${chartHeight} L 0 ${chartHeight} Z`;

    const processedRepos = user.pinnedItems.nodes.map((repo: any) => {
      const readme = repo.readme?.text || "";
      const imgMatch = readme.match(/!\[.*?\]\((.*?)\)/) || readme.match(/<img.*?src=["'](.*?)["']/);
      let imgUrl = imgMatch ? imgMatch[1].split(' ')[0].replace(/["']/g, '') : null;
      if (imgUrl && !imgUrl.startsWith('http')) {
        imgUrl = `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/main/${imgUrl.replace(/^\.\//, '')}`;
      }
      return { ...repo, imgUrl };
    });

    return new ImageResponse(
      (
        <div style={{
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          backgroundColor: '#000000', color: '#ffffff', padding: '50px', fontFamily: 'monospace'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '80px' }}>
            
            {/* LARGE DONUT */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="300" height="300" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#111" strokeWidth="10"></circle>
                  {sortedLangs.reduce((acc: any, lang: any, i) => {
                    const perc = (lang.size / totalSize) * 100;
                    const offset = acc.offset;
                    acc.elements.push(
                      <circle key={i} cx="21" cy="21" r="15.915" fill="transparent" 
                        stroke={lang.color || '#fff'} strokeWidth="10" 
                        strokeDasharray={`${perc} ${100 - perc}`} strokeDashoffset={-offset}
                      />
                    );
                    acc.offset += perc; return acc;
                  }, { elements: [], offset: 0 }).elements}
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '40px', gap: '15px' }}>
                  {sortedLangs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', width: '20px', height: '20px', backgroundColor: l.color, marginRight: '15px' }} />
                      <div style={{ display: 'flex', fontSize: '24px', fontWeight: 'bold', color: '#FFFFFF' }}>{l.name}</div>
                    </div>
                  ))}
                </div>
            </div>

            {/* EXTENDED GRAPH WITH EVERY DAY LABELED */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '750px' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: '#FFFFFF', marginBottom: '20px', letterSpacing: '2px', fontWeight: 'bold' }}>
                   MONTHLY_ACTIVITY_PULSE // 30_DAY_STREAMS
                </div>
                
                <div style={{ display: 'flex', position: 'relative', width: '700px', height: '200px', borderLeft: '2px solid #555', borderBottom: '2px solid #555', marginLeft: '50px' }}>
                    
                    {/* Y-AXIS (EVERY SECTION LABELED) */}
                    {[1, 0.75, 0.5, 0.25, 0].map((factor, i) => (
                        <div key={i} style={{ 
                            display: 'flex', position: 'absolute', left: '-45px', 
                            top: `${(1 - factor) * 100}%`, transform: 'translateY(-50%)',
                            fontSize: '11px', color: factor === 1 ? '#FFF' : '#777', fontWeight: factor === 1 ? 'bold' : 'normal'
                        }}>
                            {Math.round(maxVal * factor)}
                        </div>
                    ))}

                    {/* GRID */}
                    <div style={{ display: 'flex', position: 'absolute', width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'space-between' }}>
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} style={{ display: 'flex', width: '100%', height: '1px', borderTop: '1px dashed #222' }} />
                        ))}
                    </div>
                    
                    <svg width="700" height="200" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                        <path d={areaPath} fill="rgba(255, 255, 255, 0.03)" />
                        <path d={linePath} fill="none" stroke="#ffffff" strokeWidth="3" />
                        {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#444" stroke="#fff" strokeWidth="1" />
                        ))}
                    </svg>

                    {/* X-AXIS (EVERY DAY LABELED) */}
                    {points.map((p, i) => (
                        <div key={i} style={{ 
                            display: 'flex', position: 'absolute', left: `${p.x}px`, bottom: '-25px',
                            transform: 'translateX(-50%)', fontSize: '9px', color: '#888'
                        }}>
                            {p.day}
                        </div>
                    ))}
                </div>
            </div>
          </div>

          {/* REPOSITORIES */}
          <div style={{ display: 'flex', gap: '30px', width: '100%' }}>
            {processedRepos.map((repo: any, i: number) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, border: '1px solid #444', backgroundColor: '#050505' }}>
                    <div style={{ display: 'flex', width: '100%', height: '200px', backgroundColor: '#000', overflow: 'hidden' }}>
                        {repo.imgUrl ? (
                          <img src={repo.imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', padding: '25px', fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
                            {repo.readme?.text?.slice(0, 250).replace(/[#*`_]/g, '')}...
                          </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '25px', borderTop: '1px solid #444' }}>
                        <div style={{ display: 'flex', fontSize: '26px', fontWeight: 'bold', color: '#FFFFFF', marginBottom: '10px' }}>{repo.name}</div>
                        <div style={{ display: 'flex', fontSize: '15px', color: '#BBBBBB', lineHeight: '1.5' }}>{repo.description || "No description."}</div>
                    </div>
                </div>
            ))}
          </div>

        </div>
      ),
      { width: 1600, height: 1100 }
    );
  } catch (err: any) {
    return new Response(`SYSTEM_FAILURE: ${err.message}`, { status: 500 });
  }
}
