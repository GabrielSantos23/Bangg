# 🖼️ Ferramenta de Captura de Tela - Screen Capture Tool

Uma ferramenta completa estilo **Snipping Tool** para capturar áreas específicas da tela no Tauri v2.

## 📋 Funcionalidades

- ✅ Overlay fullscreen semi-transparente
- ✅ Seleção de área com arrastar (drag & drop)
- ✅ Preview em tempo real da área selecionada
- ✅ Indicador de dimensões (largura × altura)
- ✅ Suporte a múltiplos monitores
- ✅ Cancelamento com ESC ou botão
- ✅ Retorna imagem em base64

## 🚀 Como Usar

### 1. Usando o Hook `useScreenCapture`

```tsx
import { useScreenCapture } from "@/hooks/useScreenCapture";

function MyComponent() {
  const { startCapture, isCapturing, capturedImage, error } = useScreenCapture();

  // Iniciar captura
  const handleCapture = async () => {
    await startCapture();
  };

  // A imagem capturada será automaticamente atualizada em `capturedImage`
  // quando o usuário selecionar uma área

  return (
    <div>
      <button onClick={handleCapture} disabled={isCapturing}>
        {isCapturing ? "Capturando..." : "Capturar Tela"}
      </button>
      
      {capturedImage && (
        <img src={`data:image/png;base64,${capturedImage}`} alt="Captured" />
      )}
      
      {error && <p>Erro: {error}</p>}
    </div>
  );
}
```

### 2. Usando diretamente com `invoke`

```tsx
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Iniciar captura
await invoke("start_screen_capture");

// Escutar evento quando captura for concluída
const unlisten = await listen<string>("captured-selection", (event) => {
  const base64Image = event.payload;
  console.log("Imagem capturada:", base64Image);
  // Usar a imagem...
});

// Cancelar captura (se necessário)
await invoke("close_overlay_window");
```

### 3. Integração com Chat (exemplo)

```tsx
import { useScreenCapture } from "@/hooks/useScreenCapture";

function ChatWithCapture() {
  const { startCapture, capturedImage } = useScreenCapture();
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    if (capturedImage) {
      setAttachments([...attachments, capturedImage]);
    }
  }, [capturedImage]);

  return (
    <div>
      <button onClick={startCapture}>Capturar Área</button>
      {/* Resto do componente de chat */}
    </div>
  );
}
```

## 🎨 Componente Overlay

O componente `ScreenCaptureOverlay` é renderizado automaticamente quando a janela de overlay é criada. Ele fornece:

- **Overlay escuro** com área selecionada destacada
- **Bordas azuis** na área selecionada
- **Handles** nos cantos para indicar seleção
- **Indicador de dimensões** mostrando largura × altura
- **Botão de cancelar** no canto superior direito
- **Suporte a ESC** para cancelar

## 🔧 Estrutura Técnica

### Backend (Rust)

- **`capture.rs`**: Contém toda a lógica de captura
  - `start_screen_capture`: Inicia o processo de captura
  - `capture_selected_area`: Captura a área selecionada
  - `close_overlay_window`: Fecha a janela de overlay

### Frontend (React)

- **`ScreenCaptureOverlay.tsx`**: Componente de overlay
- **`useScreenCapture.tsx`**: Hook para gerenciar estado
- **`capture-overlay.tsx`**: Rota para a janela de overlay

## 📝 Comandos Tauri

### `start_screen_capture`
Inicia o processo de captura. Cria uma janela overlay fullscreen.

**Retorno**: `Result<(), String>`

### `capture_selected_area`
Captura a área selecionada pelo usuário.

**Parâmetros**:
```typescript
{
  coords: {
    x: number;      // Posição X (pixels)
    y: number;      // Posição Y (pixels)
    width: number;  // Largura (pixels)
    height: number; // Altura (pixels)
  }
}
```

**Retorno**: `Result<String, String>` (base64 da imagem PNG)

### `close_overlay_window`
Fecha a janela de overlay e cancela a captura.

**Retorno**: `Result<(), String>`

## 🎯 Eventos Tauri

### `captured-selection`
Emitido quando uma área é capturada com sucesso.

**Payload**: `string` (base64 da imagem PNG)

### `capture-closed`
Emitido quando a janela de overlay é fechada.

**Payload**: `()`

## ⚠️ Observações

1. **Múltiplos Monitores**: A ferramenta detecta automaticamente o monitor onde a janela principal está localizada.

2. **Transparência**: A janela de overlay é totalmente transparente e sempre no topo.

3. **Cancelamento**: O usuário pode cancelar a captura:
   - Pressionando **ESC**
   - Clicando no botão **X** no canto superior direito
   - Chamando `close_overlay_window` programaticamente

4. **Seleção Mínima**: Áreas menores que 5×5 pixels são ignoradas.

## 🐛 Troubleshooting

### Overlay não aparece
- Verifique se a janela principal está visível
- Confirme que não há erros no console do Rust

### Captura retorna erro
- Verifique se as coordenadas estão dentro dos limites da tela
- Confirme que a imagem foi capturada antes da seleção

### Imagem não aparece
- Verifique se está escutando o evento `captured-selection`
- Confirme que o base64 está sendo usado corretamente: `data:image/png;base64,${base64String}`

## 📦 Dependências

### Rust
- `xcap`: Para captura de tela
- `image`: Para processamento de imagens
- `base64`: Para codificação base64

### TypeScript/React
- `@tauri-apps/api`: Para comunicação com backend
- `react`: Framework UI
- `tailwindcss`: Estilização

