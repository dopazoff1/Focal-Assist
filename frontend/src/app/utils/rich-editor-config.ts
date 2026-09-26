const FLOWCHART_TEMPLATE = `
  <div class="focal-flowchart" contenteditable="false">
    <div class="focal-flow-node" contenteditable="true">Start</div>
    <div class="focal-flow-arrow" aria-hidden="true">↓</div>
    <div class="focal-flow-node" contenteditable="true">Next step</div>
    <div class="focal-flow-arrow" aria-hidden="true">↓</div>
    <div class="focal-flow-node" contenteditable="true">Outcome</div>
  </div>
  <p><br></p>
`;

const EDITOR_CONTENT_STYLE = `
  body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 15px; line-height: 1.55; margin: 1rem; color: #182235; }
  h1,h2,h3,h4 { line-height: 1.25; margin: 0.8rem 0 0.55rem; }
  p { margin: 0 0 0.72rem; }
  blockquote { margin: 0.9rem 0; padding: 0.6rem 0.85rem; border-left: 3px solid #0098ff; background: #f2f8fc; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; }
  table th, table td { border: 1px solid #cbd5e1; padding: 0.48rem 0.56rem; }
  .img-responsive { max-width: 100%; height: auto; }
  .img-rounded { border-radius: 12px; }
  .img-shadow { box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18); }
  .focal-flowchart { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin: 1rem auto; padding: 1rem; max-width: 480px; border: 1px solid #b8c6d8; background: #f8fbfd; }
  .focal-flow-node { min-width: 160px; padding: 0.65rem 0.9rem; border: 2px solid #0098ff; border-radius: 8px; background: #ffffff; text-align: center; font-weight: 700; }
  .focal-flow-arrow { color: #0098ff; font-size: 1.35rem; line-height: 1; }
  pre.mermaid { white-space: pre-wrap; }
`;

export function createfocalRichEditorInit(height: number): any {
  return {
    license_key: 'gpl',
    base_url: '/tinymce',
    suffix: '.min',
    height,
    menubar: 'file edit view insert format tools table help',
    branding: false,
    promotion: false,
    elementpath: true,
    browser_spellcheck: true,
    contextmenu: 'undo redo | inserttable | cell row column deletetable | link image media | code',
    plugins: [
      'advlist',
      'autolink',
      'lists',
      'link',
      'image',
      'charmap',
      'anchor',
      'searchreplace',
      'visualblocks',
      'code',
      'fullscreen',
      'insertdatetime',
      'media',
      'table',
      'preview',
      'help',
      'wordcount',
      'quickbars',
      'autosave',
      'nonbreaking',
      'save'
    ],
    toolbar: [
      'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor',
      'alignleft aligncenter alignright alignjustify | outdent indent | numlist bullist',
      'link image media table | blockquote hr focalFlowchart | removeformat | subscript superscript | fullscreen preview code | help'
    ],
    toolbar_sticky: true,
    toolbar_sticky_offset: 64,
    quickbars_selection_toolbar: 'bold italic underline | blocks | forecolor backcolor | link blockquote',
    quickbars_insert_toolbar: 'image media table hr focalFlowchart',
    image_title: true,
    automatic_uploads: true,
    paste_data_images: true,
    image_caption: true,
    image_advtab: true,
    image_class_list: [
      { title: 'Responsive', value: 'img-responsive' },
      { title: 'Rounded', value: 'img-rounded' },
      { title: 'Shadow', value: 'img-shadow' }
    ],
    file_picker_types: 'image media',
    file_picker_callback: (callback: (url: string, meta?: Record<string, string>) => void, _value: string, meta: { filetype?: string }): void => {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = meta.filetype === 'media' ? 'video/*,audio/*' : 'image/*';
      input.onchange = (): void => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
          window.alert('Choose a file smaller than 8 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (): void => {
          if (typeof reader.result !== 'string') return;
          callback(reader.result, { title: file.name });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    },
    table_default_attributes: { border: '1' },
    table_default_styles: { width: '100%' },
    link_default_target: '_blank',
    link_assume_external_targets: true,
    autosave_interval: '20s',
    autosave_retention: '30m',
    content_style: EDITOR_CONTENT_STYLE,
    setup: (editor: any): void => {
      editor.ui.registry.addButton('focalFlowchart', {
        text: 'Flowchart',
        tooltip: 'Insert an editable flowchart block',
        onAction: (): void => editor.insertContent(FLOWCHART_TEMPLATE)
      });
    }
  };
}

export const focal_EDITOR_CONTENT_STYLE = EDITOR_CONTENT_STYLE;
