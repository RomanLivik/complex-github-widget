import { ImageResponse } from 'next/og';
import { GraphQLClient, gql } from 'graphql-request';

const endpoint = 'https://api.github.com/graphql';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');

  if (!username) return new Response('Username required', { status: 400 });

  const client = new GraphQLClient(endpoint, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
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
              description
              readme: object(expression: "HEAD:README.md") { ... on Blob { text } }
            }
          }
        }
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { contributionCount color } }
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

    const lastWeeks = user.contributionsCollection.contributionCalendar.weeks.slice(-30);
    const activityPoints = lastWeeks.map((w: any) => 
        w.contributionDays.reduce((acc: any, d: any) => acc + d.contributionCount, 0)
    );
    const maxActivity = Math.max(...activityPoints) || 1;

    const processedRepos = user.pinnedItems.nodes.map((repo: any) => {
      const readmeText = repo.readme?.text || "";
      const imgMatch = readmeText.match(/!\[.*?\]\((.*?)\)/) || readmeText.match(/<img.*?src=["'](.*?)["']/);
      let firstImage = imgMatch ? imgMatch[1] : null;
      if (firstImage && (firstImage.startsWith('/') || !firstImage.startsWith('http'))) firstImage = null; 
      const cleanText = readmeText.replace(/[#*`_\[\]]/g, '').slice(0, 160);
      return { ...repo, firstImage, cleanText };
    });

    return new ImageResponse(
      (
        <div style={{
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          backgroundColor: '#000000', color: '#ffffff', padding: '40px', fontFamily: 'monospace'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '40px' }}>
            {/* LARGE DONUT CHART */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="280" height="280" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#111" strokeWidth="6"></circle>
                  {sortedLangs.reduce((acc: any, lang: any, i) => {
                    const perc = (lang.size / totalSize) * 100;
                    const offset = acc.offset;
                    acc.elements.push(
                      <circle key={i} cx="21" cy="21" r="15.915" fill="transparent" 
                        stroke={lang.color || '#fff'} strokeWidth="6" 
                        strokeDasharray={`${perc} ${100 - perc}`} strokeDashoffset={-offset}
                      />
                    );
                    acc.offset += perc; return acc;
                  }, { elements: [], offset: 0 }).elements}
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '40px', gap: '12px' }}>
                  {sortedLangs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', width: '16px', height: '16px', backgroundColor: l.color, marginRight: '15px' }} />
                      <div style={{ display: 'flex', fontSize: '20px', fontWeight: 'bold' }}>{l.name}</div>
                    </div>
                  ))}
                </div>
            </div>

            {/* MILITECH CANTO MK.6 (FLAT TECH STYLE) */}
            <div style={{ 
                display: 'flex', width: '400px', height: '280px', backgroundColor: '#050505',
                border: '1px solid #333', padding: '20px', position: 'relative',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', fontSize: '10px', color: '#ff003c' }}>MILITECH // CANTO_MK.6</div>
                  <div style={{ display: 'flex', fontSize: '10px', color: '#333' }}>DECRYPTING...</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {user.contributionsCollection.contributionCalendar.weeks.slice(-14).map((w: any, wi: number) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {w.contributionDays.map((d: any, di: number) => (
                          <div key={di} style={{ display: 'flex', width: '14px', height: '14px', backgroundColor: d.contributionCount > 0 ? '#fff' : '#111' }} />
                        ))}
                      </div>
                    ))}
                </div>
                {/* Tech lines for design */}
                <div style={{ display: 'flex', position: 'absolute', bottom: '0', right: '0', width: '40px', height: '40px', borderRight: '2px solid #ff003c', borderBottom: '2px solid #ff003c' }} />
            </div>
          </div>

          {/* REPOSITORIES - GOOGLE NEWS TABS */}
          <div style={{ display: 'flex', gap: '20px', width: '100%', marginBottom: '40px' }}>
            {processedRepos.map((repo: any, i: number) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, border: '1px solid #222', backgroundColor: '#020202' }}>
                    <div style={{ display: 'flex', width: '100%', height: '140px', backgroundColor: '#080808', overflow: 'hidden' }}>
                        {repo.firstImage ? (
                          <img src={repo.firstImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', padding: '15px', fontSize: '11px', color: '#444', lineHeight: '1.4' }}>{repo.cleanText}</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '15px', borderTop: '1px solid #222' }}>
                        <div style={{ display: 'flex', fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{repo.name}</div>
                        <div style={{ display: 'flex', width: '30px', height: '2px', backgroundColor: '#fff', marginTop: '10px' }} />
                    </div>
                </div>
            ))}
          </div>

          {/* BOTTOM ACTIVITY HISTOGRAM */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', fontSize: '10px', color: '#444' }}>ACTIVITY_HISTOGRAM_BUFFER</div>
                <div style={{ display: 'flex', fontSize: '10px', color: '#444' }}>V1.0.4_STABLE</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100px', width: '100%', gap: '4px' }}>
                {activityPoints.map((val: number, i: number) => (
                    <div key={i} style={{ 
                        display: 'flex', flex: 1, 
                        height: `${(val / maxActivity) * 90 + 10}%`, 
                        backgroundColor: '#fff', opacity: 0.1 + (val / maxActivity) * 0.9 
                    }} />
                ))}
            </div>
          </div>

        </div>
      ),
      { width: 1100, height: 900 }
    );
  } catch (err) {
    return new Response('CRITICAL_SYSTEM_ERROR: Check your API Token and URL', { status: 500 });
  }
}
