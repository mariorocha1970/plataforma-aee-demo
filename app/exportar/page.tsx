"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PendingExport = { content: string; filename: string; format: "docx" | "txt"; createdAt: number };
type WritableFile = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
type FileHandle = { createWritable: () => Promise<WritableFile> };
type DirectoryHandle = { getFileHandle: (name: string, options: { create: boolean }) => Promise<FileHandle> };

function exportForm(item: PendingExport) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/export";
  form.style.display = "none";
  [["content", item.content], ["filename", item.filename], ["format", item.format]].forEach(([name, value]) => {
    const input = document.createElement("textarea");
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export default function ExportPage() {
  const [item, setItem] = useState<PendingExport | null>(null);
  const [status, setStatus] = useState("");
  const [embedded, setEmbedded] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("aee-export-pending");
        if (raw) setItem(JSON.parse(raw));
        setEmbedded(window.self !== window.top);
      } catch { setStatus("Não foi possível recuperar o documento preparado."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createBlob(current: PendingExport) {
    const body = new FormData();
    body.set("content", current.content);
    body.set("filename", current.filename);
    body.set("format", current.format);
    const response = await fetch("/api/export", { method: "POST", body });
    if (!response.ok) throw new Error(await response.text());
    return response.blob();
  }

  async function chooseFolder() {
    if (!item) return;
    if (window.self !== window.top) {
      setStatus("A página está incorporada noutra aplicação. Por segurança, o navegador só permite escolher uma pasta numa janela independente. Selecione o botão «Abrir numa janela independente».");
      return;
    }
    const extension = item.format === "docx" ? ".docx" : ".txt";
    const fullName = `${item.filename}${extension}`;
    const browser = window as typeof window & { showDirectoryPicker?: () => Promise<DirectoryHandle>; showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileHandle> };
    try {
      let handle: FileHandle;
      if (browser.showDirectoryPicker) {
        const directory = await browser.showDirectoryPicker();
        handle = await directory.getFileHandle(fullName, { create: true });
      } else if (browser.showSaveFilePicker) {
        handle = await browser.showSaveFilePicker({ suggestedName: fullName });
      } else {
        setStatus("Este navegador não permite escolher uma pasta. Use Chrome ou Edge, abra esta página diretamente e selecione «Transferência normal».");
        return;
      }
      setStatus("A criar o documento…");
      const writable = await handle.createWritable();
      await writable.write(await createBlob(item));
      await writable.close();
      setStatus(`Documento guardado com sucesso: ${fullName}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setStatus("A escolha da pasta foi cancelada.");
      else setStatus(error instanceof Error ? `Não foi possível guardar: ${error.message}` : "Não foi possível guardar o documento.");
    }
  }

  async function copyDocument() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.content);
      setStatus("Documento copiado. Abra o Microsoft Word, pressione Ctrl+V e utilize «Ficheiro > Guardar como» para escolher a pasta.");
    } catch {
      const area = document.createElement("textarea");
      area.value = item.content;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      setStatus(copied ? "Documento copiado. Abra o Microsoft Word, pressione Ctrl+V e utilize «Ficheiro > Guardar como»." : "A cópia automática foi bloqueada. Abra a pré-visualização, selecione o texto e copie-o manualmente.");
    }
  }

  return <main className="export-center">
    <section className="export-card">
      <p className="eyebrow">AEE · Exportação segura</p>
      <h1>Guardar documento no computador</h1>
      {!item ? <div className="export-warning"><strong>Não existe um documento preparado.</strong><p>Regresse à plataforma e selecione novamente um dos botões de exportação.</p></div> : <>
        <div className="export-file"><span>{item.format === "docx" ? "WORD" : "TXT"}</span><div><strong>{item.filename}.{item.format}</strong><small>{item.content.length.toLocaleString("pt-PT")} caracteres preparados</small></div></div>
        {embedded ? <div className="export-embedded"><strong>Limitação do alojamento privado</strong><p>O navegador proíbe a escolha de pastas nesta janela incorporada e o alojamento privado não autoriza a abertura numa janela independente. Utilize «Copiar documento para o Word» e, no Word, escolha «Guardar como».</p></div> : <div className="export-instruction"><strong>O documento está pronto.</strong><span>Selecione agora o botão verde para abrir a janela de pastas do Windows.</span></div>}
        <div className="export-actions"><button className="button primary" onClick={copyDocument}>1. Copiar documento para o Word</button><button className="button secondary" disabled={embedded === true} onClick={chooseFolder}>2. Escolher pasta e guardar</button><button className="button secondary" onClick={() => exportForm(item)}>3. Transferência normal</button></div>
        <p className="export-help">Após copiar, abra o Word, pressione <kbd>Ctrl</kbd> + <kbd>V</kbd> e selecione «Ficheiro &gt; Guardar como». A escolha direta de pasta permanece disponível apenas quando o Centro não está incorporado.</p>
        <details><summary>Pré-visualizar o conteúdo</summary><pre>{item.content.slice(0, 12000)}</pre></details>
      </>}
      {status && <div className="export-status" role="status">{status}</div>}
      <Link className="text-button" href="/">Regressar à plataforma</Link>
    </section>
  </main>;
}
