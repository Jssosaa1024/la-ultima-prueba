/**
 * basis-sin-eval (T02b): copia el transcodificador Basis de three.js sin `Function(...)`.
 *
 *   npm run basis-sin-eval
 *
 * El transcodificador (`three/examples/jsm/libs/basis/basis_transcoder.js`, Basis Universal,
 * Apache 2.0) está compilado con Emscripten y embind, que arma cada función con
 * `new Function(...)`. Eso exige `'unsafe-eval'`, y la CSP del sitio no lo permite: el worker
 * de KTX2 fallaba y las texturas no cargaban. Este script reemplaza `craftInvokerFunction` por
 * la versión sin código generado (la que Emscripten usa con `DYNAMIC_EXECUTION=0`) y escribe
 * `src/engine/carga/basis/basis_transcoder_sin_eval.js`. El cargador lo usa en lugar del
 * original (`cargador.ts`). Una prueba de unidad falla si el archivo queda viejo al cambiar de
 * versión de three.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ORIGINAL = fileURLToPath(
  new URL('../../node_modules/three/examples/jsm/libs/basis/basis_transcoder.js', import.meta.url),
);
export const DESTINO = fileURLToPath(
  new URL('../../src/engine/carga/basis/basis_transcoder_sin_eval.js', import.meta.url),
);

const INICIO = 'function craftInvokerFunction(';
const FIN = 'return createNamedFunction(humanName,invokerFn)}';

/**
 * Mismo comportamiento que el invocador que embind genera como texto: revisa la cantidad de
 * argumentos, convierte cada uno con `toWireType`, llama a la función de C++, libera lo que haga
 * falta y convierte el resultado con `fromWireType`.
 */
const SIN_EVAL = `function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc,isAsync){
  // T02b (La Última Prueba): sin generar código, para la CSP sin 'unsafe-eval'.
  var argCount=argTypes.length;
  if(argCount<2){throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")}
  var isClassMethodFunc=argTypes[1]!==null&&classType!==null;
  var needsDestructorStack=usesDestructorStack(argTypes);
  var returns=argTypes[0].name!=="void";
  var expected=argCount-2;
  var invokerFn=function(...args){
    if(args.length!==expected){throwBindingError("function "+humanName+" called with "+args.length+" arguments, expected "+expected)}
    var destructors=needsDestructorStack?[]:null;
    var wired=[];
    var thisWired;
    if(isClassMethodFunc){thisWired=argTypes[1]["toWireType"](destructors,this);wired.push(thisWired)}
    for(var i=0;i<expected;++i){wired.push(argTypes[i+2]["toWireType"](destructors,args[i]))}
    var rv=cppInvokerFunc(cppTargetFunc,...wired);
    if(needsDestructorStack){runDestructors(destructors)}
    else{
      for(var j=isClassMethodFunc?1:2;j<argTypes.length;++j){
        var param=j===1?thisWired:wired[isClassMethodFunc?j-1:j-2];
        if(argTypes[j].destructorFunction!==null){argTypes[j].destructorFunction(param)}
      }
    }
    if(returns){return argTypes[0]["fromWireType"](rv)}
  };
  return createNamedFunction(humanName,invokerFn)}`;

const INICIO_EMVAL = 'var __emval_get_method_caller=';
const FIN_EMVAL =
  'return emval_addMethodCaller(createNamedFunction(functionName,invokerFunction))};';

/**
 * El llamador de métodos de emval (C++ llama a un método o constructor de JS), sin código
 * generado. `kind`: 0, método de `obj`; 1, `new func(...)`; otro, `func.call(arg0, ...)`.
 */
const EMVAL_SIN_EVAL = `var __emval_get_method_caller=(argCount,argTypes,kind)=>{
  // T02b (La Última Prueba): sin generar código, para la CSP sin 'unsafe-eval'.
  var types=emval_lookupTypes(argCount,argTypes);
  var retType=types.shift();
  argCount--;
  var invokerFunction=function(obj,func,destructorsRef,args){
    var offset=0;
    var vals=[];
    for(var i=0;i<argCount;++i){vals.push(types[i].readValueFromPointer(args+offset));offset+=types[i]["argPackAdvance"]}
    var rv=kind===1?new func(...vals):kind===0?func.call(obj,...vals):func.call(...vals);
    if(!retType.isVoid){return emval_returnValue(retType,destructorsRef,rv)}
  };
  var functionName=\`methodCaller<(\${types.map(t=>t.name).join(", ")}) => \${retType.name}>\`;
  return emval_addMethodCaller(createNamedFunction(functionName,invokerFunction))};`;

/** Reemplaza el único tramo entre `inicio` y `fin` (incluidos). */
function reemplazar(texto: string, inicio: string, fin: string, nuevo: string): string {
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin, desde);
  if (desde < 0 || hasta < 0 || texto.indexOf(inicio, desde + 1) >= 0) {
    throw new Error(`basis_transcoder.js cambió: no se encontró ${inicio}`);
  }
  return texto.slice(0, desde) + nuevo + texto.slice(hasta + fin.length);
}

const CABECERA = `// Generado por scripts/csp/basis-sin-eval.ts a partir de
// three/examples/jsm/libs/basis/basis_transcoder.js (Basis Universal, Apache 2.0).
// No editar a mano: correr \`npm run basis-sin-eval\`.
`;

/** El texto del transcodificador sin `Function(...)`. Falla si three cambió la forma. */
export function sinEval(original: string): string {
  const texto = reemplazar(
    reemplazar(original, INICIO, FIN, SIN_EVAL),
    INICIO_EMVAL,
    FIN_EMVAL,
    EMVAL_SIN_EVAL,
  );
  if (/newFunc\(Function|new Function|\beval\(/.test(texto)) {
    throw new Error('basis_transcoder.js todavía crea código con Function o eval');
  }
  return CABECERA + texto;
}

async function principal(): Promise<void> {
  await writeFile(DESTINO, sinEval(await readFile(ORIGINAL, 'utf8')));
  console.log(`basis-sin-eval: escrito ${DESTINO}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await principal();
