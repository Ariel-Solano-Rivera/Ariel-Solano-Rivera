# Instrucciones de uso

Este proyecto genera automáticamente el panel profesional (`light.svg` y `dark.svg`) y el mapa de contribuciones (`dist/github-jet.svg`). El `README.md` ya usa rutas relativas, por lo que no necesitas cambiar URLs al publicarlo.

## 1. Personalizar los datos

Edita `profile.config.json` para cambiar nombre, usuario, rol, ubicación, formación, estado, áreas de enfoque, tecnologías y contactos. Los colores principales de cada tema se controlan con `accentLight` y `accentDark`.

El retrato visible está convertido a caracteres en `assets/avatar-ascii.txt`. `assets/pixel-avatar.png` se conserva como imagen fuente. Para sustituir el retrato mantén el archivo ASCII con aproximadamente 90 columnas y 56 líneas, para que permanezca dentro del panel.

Mantén la estructura JSON y las comillas dobles. Si agregas tecnologías, procura usar nombres breves para conservar el diseño. Los enlaces de contacto deben incluir `https://` o `mailto:`.

## 2. Generar los archivos localmente

Instala Node.js 20 o superior, abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm run build
```

Sin un token, el mapa usa datos de muestra deterministas para que puedas previsualizarlo. Para usar contribuciones reales localmente:

```bash
GH_USERNAME=Ariel-Solano-Rivera GH_TOKEN=tu_token npm run generate:heatmap
```

En PowerShell:

```powershell
$env:GH_USERNAME="Ariel-Solano-Rivera"
$env:GH_TOKEN="tu_token"
npm run generate:heatmap
```

No guardes ni publiques el token. GitHub Actions utiliza automáticamente `GITHUB_TOKEN`.

## 3. Crear el repositorio de perfil

1. En GitHub, crea un repositorio público llamado exactamente `Ariel-Solano-Rivera`, igual que tu usuario.
2. Si GitHub muestra la opción de perfil especial, confirma que el repositorio sea público.
3. No hace falta inicializarlo con otro README porque este paquete ya contiene uno.

## 4. Subir los archivos

Sube todo el contenido de esta carpeta a la raíz del repositorio, conservando las carpetas `scripts`, `dist` y `.github/workflows`.

También puedes usar Git:

```bash
git init
git add .
git commit -m "feat: crear perfil de GitHub"
git branch -M main
git remote add origin https://github.com/Ariel-Solano-Rivera/Ariel-Solano-Rivera.git
git push -u origin main
```

## 5. Dar permiso de escritura a la acción

En el repositorio abre:

`Settings > Actions > General > Workflow permissions > Read and write permissions`

Selecciona **Read and write permissions** y guarda los cambios. La acción ya declara `contents: write`, pero el permiso del repositorio también debe estar habilitado.

## 6. Ejecutar la acción por primera vez

1. Abre la pestaña **Actions** del repositorio.
2. Selecciona **Update profile artwork**.
3. Pulsa **Run workflow**, elige la rama `main` y confirma.
4. Cuando termine, la acción habrá consultado tus contribuciones reales y guardado los SVG actualizados.

Después se ejecutará diariamente y también cuando cambien la configuración o los generadores.
