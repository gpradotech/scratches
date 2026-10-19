import {Icon} from './UI.tsx';
import './metadataSelect.css';

export function CreateOptionLabel({children}: {children: string}) {
  return <span className="metadata-option metadata-option--create"><Icon name="plus" size={20}/><span>{children}</span></span>;
}
