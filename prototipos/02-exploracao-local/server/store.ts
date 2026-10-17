import fs from 'node:fs/promises';
import path from 'node:path';
import {emptyWorkspace, validateWorkspace} from '../src/domain/model.ts';
import type {Workspace} from '../src/domain/model.ts';
export class Conflict extends Error {}
export class WorkspaceStore {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  blocked = false;
  get busy() {return this.pending > 0;}
  async idle() {await this.tail.catch(() => {});}
  readonly file: string;
  constructor(file: string) {this.file = file;}
  async read(): Promise<Workspace> {
    try {const state: unknown = JSON.parse(await fs.readFile(this.file, 'utf8')); validateWorkspace(state); return state;}
    catch (e) {if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyWorkspace(); throw e;}
  }
  save(value: unknown): Promise<Workspace> {
    if (this.blocked) return Promise.reject(new Error('O Scratches está reiniciando para atualizar. Aguarde um instante.'));
    this.pending++;
    const operation = this.tail.catch(() => {}).then(async () => {
      validateWorkspace(value);
      const current = await this.read();
      if (value.revision !== current.revision) throw new Conflict('O espaço foi alterado em outra janela. Atualize antes de tentar novamente.');
      const next = {...value, revision: current.revision + 1};
      await fs.mkdir(path.dirname(this.file), {recursive: true});
      const temporary = this.file + '.pending';
      await fs.writeFile(temporary, JSON.stringify(next, null, 2) + '\n', {encoding: 'utf8', mode: 0o600});
      await fs.rename(temporary, this.file);
      return next;
    });
    const tracked = operation.finally(() => {this.pending--;});
    this.tail = tracked;
    return tracked;
  }
}
