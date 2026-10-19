import {Dialog} from './UI.tsx';
import './searchHelp.css';

const examples = [
  ['"amor e paz"', 'Frase exata: palavras consecutivas, na ordem digitada.'],
  ['amor OR paz', 'Um termo, o outro ou ambos.'],
  ['amor AND paz', 'Os dois termos na mesma música, mesmo em versos diferentes.'],
  ['amor -guerra', 'Exclui músicas com o termo. Também aceita -"frase exata".'],
  ['intitle:amor', 'Pesquisa apenas no título da música.'],
  ['inlyric:amor', 'Pesquisa apenas nas letras indexadas.'],
  ['album:"Sobrevivendo no Inferno"', 'Pesquisa no título do álbum, EP ou single.'],
  ["artist:\"Racionais MC's\"", 'Pesquisa no nome dos artistas, incluindo participações.'],
];
export function SearchHelp({onClose}: {onClose: () => void}) {
  return <Dialog title="Pesquisa avançada" className="search-help-dialog" onClose={onClose}>
      <p>Digite os operadores no campo de busca. Você pode combiná-los com os filtros opcionais.</p>
      <dl className="search-operator-list">{examples.map(([example, description]) => <div key={example}><dt><code>{example}</code></dt><dd>{description}</dd></div>)}</dl>
      <p className="caption">Use AND e OR em maiúsculas. AND é aplicado antes de OR. Com operadores, espaços entre termos também funcionam como AND. Sem operadores, a busca por texto continua como antes.</p>
      <p className="caption">Aspas respeitam a ordem e os limites das palavras. Maiúsculas e acentos não diferenciam resultados. Exclusões sem prefixo consideram título, artistas, álbum e letra; use um prefixo para limitar a exclusão a um campo.</p>
      <div className="search-help-example"><strong>Exemplo combinado</strong><code>artist:Djonga AND inlyric:amor -inlyric:guerra</code></div>
    </Dialog>;
}
