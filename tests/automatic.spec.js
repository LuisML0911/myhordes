// @ts-check
// dependencias
import { test, expect, request } from '@playwright/test';
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
const { JSDOM } = require("jsdom");
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const AdmZip = require('adm-zip');
const util = require('util');
const readFile = util.promisify(fs.readFile);

//constantes
let pag = undefined;
let basePath = "";
let currentPath = "";
const user = "mylhordes";
//myhordes0
const pass = "f6e1a8350911";
const actions = {
	"/jx/ghost/welcome": joinToTown,
	"/jx/town/dashboard": playInTown,
	"/jx/beyond/desert/cached": playInDeserted,
	"/jx/game/jobcenter": selectJob,
	"/jx/soul/welcomeToNowhere": acceptDead
};
const actionsPlayTown = {
	1: startPlayTown,
	2: betweenSafeDays,
	3: betweenSafeDays,
	4: betweenSafeDays,
	5: betweenSafeDays,
}
let idPlayerInv = undefined;
const constFile = path.join(".", "tests", "constants");
const lastWordsFile = path.join(constFile, "lastWords.json");
let lastWords = {};
const baseFiles = path.join(".", "tests", "bitacora");
const nameFile_lastDataSaved = path.join(baseFiles, ".last.json");
let lastDataSaved = {};
let dataSaved = {};
let nameFile_dataSaved = baseFiles;
let gestHorderData = {};
let externalTools = false;
let countMainInvocation = 0;
let uniqueProfile;
let weaponListData = {};
let items = {};
test('UpdateWeaponData', async ({ page }) => {
	// Navegar para que el navegador obtenga la cookie de Cloudflare
	await page.goto('https://gesthordes.fr/rest/v1/prototype/all');
	
	// Intentar obtener el JSON desde dentro del navegador
	let data;
	try {
		data = await page.evaluate(async () => {
			const res = await fetch('https://gesthordes.fr/rest/v1/prototype/all', {
			headers: { "accept": "application/json" }
		});
		if (!res.ok) {
			throw new Error(`Respuesta no OK: ${res.status}`);
		}
		return res.json();
		});
	} catch (err) {
		//console.log('❌ No se pudo obtener JSON válido:', err.message);
		return; // salir sin hacer commit
	}

	writeJSON('data/weapons.json', data);
});
test('GetGestHordes', async ({page}) => {
	lastDataSaved = readJSON(nameFile_lastDataSaved);
	const idTown = lastDataSaved.idTown;
	await page.goto('https://gesthordes.fr/news', { waitUntil: 'networkidle' });	
	const cookies = await page.context().cookies();
	//console.log(cookies);
	const response = await page.evaluate(async (idTown) => {
		const res = await fetch(`https://gesthordes.fr/rest/v1/carte/${idTown}`, {
			headers: {
				"accept": "application/json",
				"gh-mapid": parseInt(idTown, 10)
			}
		});
		return res.json();
	}, idTown);
	//console.log(response);
	await page.goto(`https://gesthordes.fr/carte/${idTown}`);

	writeJSON('data/gestHordes.json', response);
});

test('myhordes', async () => { 
	test.setTimeout(250000);
	//fs.rmSync(path.join(process.env.LOCALAPPDATA, 'playwright-profiles'), { recursive: true, force: true });
	const baseDir = process.env.LOCALAPPDATA || process.env.HOME;
	uniqueProfile = path.join(baseDir, 'playwright-profiles', randomUUID());
	//const uniqueProfile = path.join(process.env.LOCALAPPDATA, 'playwright-profiles', `${randomUUID()}`);
	let browserPlay;
	let browserLogin;
	try {
		const pathToExtension = await resolveExtensionPath();
		
		browserLogin = await chromium.launchPersistentContext(uniqueProfile, {
			channel: 'msedge',
			headless: true
		});
		pag = await browserLogin.newPage();
		// se dirige al sitio
		await login();
		await new Promise(r => setTimeout(r, 5000));
		await browserLogin.close();
		browserPlay = await chromium.launchPersistentContext(uniqueProfile, {
			channel: 'msedge',
			headless: true,
			args: pathToExtension ? [
				`--disable-extensions-except=${pathToExtension}`,
				`--load-extension=${pathToExtension}`
			] : []
		});
		pag = await browserPlay.newPage();
		
		//console.error("Llendo a sitio MyHordes para redirigir: " + pag.url());
		await goto('/jx/town/dashboard');
		//console.error("Sitio redirigido: " + pag.url());
		await new Promise(r => setTimeout(r, 3000));
		//console.error("Sitio redirigido tras 3 seg: " + pag.url());
		
		if(Object.keys(weaponListData).length === 0){
			weaponListData = readJSON('data/weaponListData.json');
		}
		if(Object.keys(items).length === 0){
			items = readJSON('data/items.json');
		}
		
		// inicia ejecución
		await main();
	} catch(exception){
		console.log(exception);
	} finally {
		if(browserPlay){
			browserPlay.close();
		}
		if(browserLogin){
			browserLogin.close();
		}
		await new Promise(r => setTimeout(r, 1000));
		//fs.rmSync(uniqueProfile, { recursive: true, force: true });
	}
});
async function main(){
	countMainInvocation++;
	// prevee bucles
	if(countMainInvocation > 24){
		throw new Error("Se prevee posible bucle");
	}
	// se recuperan constantes del juego e historico del pueblo
	try{
		if(Object.keys(lastDataSaved).length === 0){
			lastDataSaved = readJSON(nameFile_lastDataSaved);
			await pag.locator('img.header-directory-icon').click({ timeout: 3000 });
			await pag.locator('img[alt="Gest\'Hordes"]').click({ timeout: 3000 });
			const [newPage] = await Promise.all([
				pag.context().waitForEvent('page'),
				pag.locator('form[action="https://gesthordes.fr/login"] button[type="submit"]').click({ timeout: 3000 }),
			]);
			console.log("OKA_0");
			console.log("🌐 Nueva pestaña abierta en:", newPage.url());
			newPage.on('response', async (response) => {
				try {
					const url = response.url();
					console.log(url);
					if (url.includes(`/rest/v1/carte/${lastDataSaved.idTown}` )) {
						console.log("✅ Respuesta GestHordes interceptada y guardada:", await response.json());
						await newPage.close();
					}
				} catch (err) {
					//console.log("❌ Error leyendo response:", err.message);
				}
			});
		}
		nameFile_dataSaved = path.join(baseFiles, lastDataSaved.idTown + ".json");
		if(Object.keys(dataSaved).length === 0){
			dataSaved = readJSON(nameFile_dataSaved);
		}
	}catch(exception){
		//console.log(exception);
		writeJSON(nameFile_lastDataSaved, lastDataSaved);
		if(Object.keys(dataSaved).length === 0){
			writeJSON(nameFile_dataSaved, {});
		}
	}finally{
		if(Object.keys(dataSaved).length != 0){
			writeJSON(nameFile_dataSaved, dataSaved);
		}
	}
	
	// se determinan acciones a realizar según la situación actual del jugador
	await evaluateWebSite();
}

// segun el path del sitio actual realiza las asignaciones correspondientes
async function evaluateWebSite(){
	currentPath = new URL(pag.url()).pathname;
	if (actions[currentPath]) {
		await actions[currentPath]();
	} else {
		await pag.waitForSelector('#postbox');
		await evaluateWebSite();
	}
}

// flujo principal cuando el jugador esta en la ciudad
async function playInTown(){
	await pag.waitForSelector('#header-rucksack-items');
	// se busca el día actual y se ejecuta el proceso correspondiente
	let currentDay = parseInt((await pag.locator('span.day-number').innerText()).replace(/\D/g, ''), 10);
	if (actionsPlayTown[currentDay]) {
		await actionsPlayTown[currentDay](currentDay);
	} else {
		await defaultPlayTown(currentDay);
	}
}

async function startPlayTown(currentDay){
	await goto("/jx/town/house/dash");
	await pag.waitForSelector('#header-rucksack-items');
	
	let inv = await getInventoryIds();
	if(dataSaved[`day${currentDay}`] === undefined){
		dataSaved[`day${currentDay}`] = {};
		dataSaved[`day${currentDay}`].currentStep = 0;
		dataSaved[`day${currentDay}`].purge = true;
		dataSaved.hasUsedDrugs = false;
		
		dataSaved.heroicAction = {};
		dataSaved.heroicAction.hallazgo = true;
		dataSaved.heroicAction.retorno = true;
		dataSaved.heroicAction.golpe = true;
		dataSaved.heroicAction.pa = true;
		
		let weaponsGestHordes = await getWeaponsGestHordes();
		if(weaponsGestHordes != undefined){
			const weapons = Object.entries(weaponsGestHordes.data.items)
			.filter(([id, obj]) => obj.kill_min !== undefined && obj.kill_min !== null)
			.map(([id, obj]) => ({ id, ...obj }));
			weaponListData.weaponList = weapons.filter(obj => obj.encombrant === false);
			weaponListData.weaponHeavyList = weapons.filter(obj => obj.encombrant === true);
			writeJSON('data/weaponListData.json', weaponListData);
		}
	}
	
	const steps = [
		async () => { // vaciar inventario
			for (let item in await getBaulInventory(inv)) {
				await moveItem(inv.IdInvBau, inv.IdInvPer, item);
			}
			await dropPlayerInventory(inv);
			return true;
		},
		async () => { // intentar usar dados y cartas si existen
			await UseAndReturn(inv, await getStorageInventory(inv), 32, "133");
			await UseAndReturn(inv, await getStorageInventory(inv), 130, "134");
			return true;
		},
		async () => { // preparar objetos para la ruta
			dataSaved[`day${currentDay}`].startItems = await prepareToExplore(inv, await getStorageInventory(inv));
			return true;
		},
		async () => { // preparar objetos para la ruta
			await doAction("/rest/v1/game/town/core/door", "PATCH", {action: "open"});
			await goto("/jx/town/house/dash");
			await pag.waitForSelector('#header-rucksack-items');
			return true;
		},
		async () => { // preparar ruta
			const foodToExplore = items.foods.find(food => food.id === dataSaved[`day${currentDay}`].startItems.idFood);
			const waterToExplore = items.waters.find(water => water.id === dataSaved[`day${currentDay}`].startItems.idWater);
			const currentPAs = await pag.locator('b[data-incidental-target="ap"]').getAttribute('data-value');
			dataSaved[`day${currentDay}`].route = await getRoute(foodToExplore.pa + waterToExplore.pa + parseInt(currentPAs, 10), dataSaved.hasUsedDrugs ? 1 : 2);
			return true;
		},
		async () => { // salir al desierto -> avance en el desierto (función playInDeserted)
			// si logró crear ruta proceder a ir al desierto, sinó ejecutar defaultPlayTown
			if(dataSaved[`day${currentDay}`].route != undefined && dataSaved[`day${currentDay}`].route.way.length != 0){
				// salir del pueblo
				await doAction("/rest/v1/game/town/core/door/exit", "POST", {});
				// refrescar
				await goto("/jx/beyond/desert/cached");
				await main();
			}else{
				// TODO: si no logró crear una ruta, entonces ejecutar jugar en ciudad
			}
			return true;
		}
	];
	try{
		for (; dataSaved[`day${currentDay}`].currentStep < steps.length; dataSaved[`day${currentDay}`].currentStep++) {
			writeJSON(nameFile_dataSaved, dataSaved);
			if(!(await steps[dataSaved[`day${currentDay}`].currentStep]())){
				break;
			}
		}
	}catch(exception){
		console.log(exception);
	}finally{
		writeJSON(nameFile_dataSaved, dataSaved);
		//TODO: ADVERTIR POR TELEGRAM QUE NO FUE POSIBLE EJECUTAR NO°_PASO
	}
}

async function betweenSafeDays(currentDay){
	await goto("/jx/town/house/dash");
	await pag.waitForSelector('#header-rucksack-items');
	
	let inv = await getInventoryIds();
	if(dataSaved[`day${currentDay}`] === undefined){
		dataSaved[`day${currentDay}`] = {};
		dataSaved[`day${currentDay}`].currentStep = 0;
		dataSaved[`day${currentDay}`].currentStep = 0;
		dataSaved[`day${currentDay}`].purge = false;
	}
	
	const steps = [
		async () => { // vaciar inventario
		
			for (let item in await getBaulInventory(inv)) {
				await moveItem(inv.IdInvBau, inv.IdInvPer, item);
			}
			await dropPlayerInventory(inv);
			return true;
		},
		async () => { // intentar usar dados y cartas si existen
			await UseAndReturn(inv, await getStorageInventory(inv), 32, "133");
			await UseAndReturn(inv, await getStorageInventory(inv), 130, "134");
			return true;
		},
		async () => { // preparar objetos para la ruta
			dataSaved[`day${currentDay}`].startItems = await prepareToExplore(inv, await getStorageInventory(inv));
			return true;
		},
		async () => { // preparar objetos para la ruta
			await doAction("/rest/v1/game/town/core/door", "PATCH", {action: "open"});
			await goto("/jx/town/house/dash");
			await pag.waitForSelector('#header-rucksack-items');
			return true;
		},
		async () => { // preparar ruta
			const foodToExplore = items.foods.find(food => food.id === dataSaved[`day${currentDay}`].startItems.idFood);
			const waterToExplore = items.waters.find(water => water.id === dataSaved[`day${currentDay}`].startItems.idWater);
			const currentPAs = await pag.locator('b[data-incidental-target="ap"]').getAttribute('data-value');
			if(foodToExplore != undefined && waterToExplore != undefined){
				dataSaved[`day${currentDay}`].route = await getRoute(foodToExplore.pa + waterToExplore.pa + parseInt(currentPAs, 10), dataSaved.hasUsedDrugs ? 1 : 2);
			}
			return true;
		},
		async () => { // salir al desierto -> avance en el desierto (función playInDeserted)
			// si logró crear ruta proceder a ir al desierto, sinó ejecutar defaultPlayTown
			if(dataSaved[`day${currentDay}`].route != undefined && dataSaved[`day${currentDay}`].route.way.length != 0){
				// salir del pueblo
				await doAction("/rest/v1/game/town/core/door/exit", "POST", {});
				// refrescar
				await goto("/jx/beyond/desert/cached");
				await main();
			}else{
				// TODO: si no logró crear una ruta, entonces ejecutar jugar en ciudad
				// validar si no en otro paso como complemento al retorno a la ciudad
			}
			return true;
		}
	];
	try{
		for (; dataSaved[`day${currentDay}`].currentStep < steps.length; dataSaved[`day${currentDay}`].currentStep++) {
			//writeJSON(nameFile_dataSaved, dataSaved);
			if(!(await steps[dataSaved[`day${currentDay}`].currentStep]())){
				break;
			}
		}
	}catch(exception){
		console.log(exception);
	}finally{
		//writeJSON(nameFile_dataSaved, dataSaved);
		//TODO: ADVERTIR POR TELEGRAM QUE NO FUE POSIBLE EJECUTAR NO°_PASO
	}
}

async function defaultPlayTown(currentDay){
	
}


// flujo principal cuando el jugador esta en el desierto
async function playInDeserted(){
	await pag.waitForSelector('#header-rucksack-items');
	try{
		// se busca el día actual y se ejecuta el proceso correspondiente
		let currentDay = parseInt((await pag.locator('span.day-number').innerText()).replace(/\D/g, ''), 10);
		const currentSaved = dataSaved[`day${currentDay}`];
		const currentPoss = currentSaved.route.way[currentSaved.route.currentPoss];
		/*
			Reglas para moverse:
				[ ] Si la zona está agotada:
					[-] Tomar objetos del suelo en base a prioridades (repetir y actualizar 3 veces)
						[ ] Abrir objetos que no requieren herramientas
						[ ] Abrir objetos que requieren herramientas
						[*] Tomar objetos pesados base a prioridad
						[*] Tomar objetos base a prioridad
					[*] Actualizar GestHordes
					[*] Moverse:
						[*] Si ya no tiene PA's:
							[*] Tomar agua primero -> Moverse
							[*] Comer primero -> Moverse
				[*] Si la zona no está agotada:
					[*] Escavar, y esperar hasta agotar
				[*] Si la zona está bajo el control de los zombies
					[*] Intentar liberar la zona antes de evaluarla y actualizar
			Reglas de combate :
				[*] Si se cuenta con objetos de combate, usarlos
				[-] Si aun se tiene poder de heroe objeto, tomar globo y usarlo
				[*] Si aun se tiene el golpe, usar golpe
				[*] Si sigue bloqueado y ya esta por terminar la noche -> intentar usar retorno del heroe o acampar y continuar ruta mañana
			
			Pasos:
				5. Si se encuentra al final de la ruta en [0,0] entrar al pueblo, sino intentar acampar
				1. Evaluar si la zona esta controlada por los zombies, si esta controlada intentar liberar y actualizar para evaluar si siguie controlada, si sigue controlada repetir 3 veces antes de alertar.
				2. Si es posible escavar se intentará recolectar recursos antes de moverse.
				3. Al moverse si no se cuenta con PA's suficientes deberán consumirse los recursos preparados para la ruta.
				4. Si faltan 3 horas para el ataque deberá avanzar sin agotar la zona hasta completar la ruta.
		*/
		
		if(currentSaved.route.currentPoss == 0 && currentPoss.x == 0 && currentPoss.y == 0){
			// ir a la siguiente posición
			const nextPoss = currentSaved.route.way[currentSaved.route.currentPoss + 1];
			if((await doAction("/api/beyond/desert/move", "POST", { x: nextPoss.x, y: nextPoss.y })).error){
				// TODO: acción si no logré moverme
			}else{
				currentSaved.route.currentPoss = currentSaved.route.currentPoss + 1;
				//writeJSON(nameFile_dataSaved, dataSaved);
				await goto('/jx/beyond/desert/cached');
				return await main();
			}
		}
		
		// 5. Si se encuentra al final de la ruta en [0,0] entrar al pueblo, TODO: sino intentar acampar
		if(currentSaved.route.currentPoss != 0 && currentPoss.x == 0 && currentPoss.y == 0){
			// salir del desierto
			await doAction("/api/beyond/desert/exit", "POST", {});
			await goto('/jx/town/bank');
			await pag.waitForSelector('#header-rucksack-items');
			let inv = await getInventoryIds();
			await dropPlayerInventory(inv);
			let playInv = await getPlayerInventory(inv);
			let outfit = await searchItemIdInv([315], playInv);
			await doAction("/api/town/house/action", "POST", {item: outfit, action: "163"});
		}else{
			// 1. Evaluar si la zona esta controlada por los zombies, si esta controlada intentar liberar y actualizar para evaluar si siguie controlada, si sigue controlada repetir 3 veces antes de alertar.
			const contZ = parseInt(await pag.textContent('.zombies-cp'), 10);
			const contH = parseInt(await pag.textContent('.humans-cp'), 10);
			let purge = (currentSaved.purge != undefined && currentSaved.purge);
			if(contZ > contH || ( contZ > 0 && (purge && currentPoss.purged == undefined))){
				const attackTime = await pag.locator('div.attack-time').innerText();
				let canUseWeapon = false;
				let canUseWeaponBattery = false;
				let canUseHeroicAction = false;
				// atacar
				const contObjetive = (currentSaved.purge != undefined && currentSaved.purge) ? 0 : contH;
				
				let inv = await getInventoryIds();
				await dropPlayerInventory(inv);
				let playInv = await getPlayerInventory(inv);
				let deseInv = await getDesertInventory(inv);
				const combination = findClosestWeaponsCombination([...weaponListData.weaponList, ...weaponListData.weaponHeavyList].filter(o => o.id !== 12), contZ - contObjetive, {...playInv, ...deseInv});
				if(combination != null){
					const useObj = combination.combo.reduce((min, obj) => obj.chance_kill < min.chance_kill ? obj : min);
					await doAction("/api/beyond/desert/action", "POST", {item: useObj.key, action: getActionIdFromHtml(await doAction("/jx/beyond/partial/desert/actions", "POST", {}), useObj.key)});
					canUseWeapon = true;
				}else{
					let battery = await searchItemIdInv([2], deseInv);
					if(battery != undefined){
						let weaponBattery = await searchMoveItem(
						[
							291,   	//Puntero láser potente descargado
							102,   	//Devastador (vacío)
							186,   	//Lanza-pilas Mark II (vacío)
							98,   	//Lanzapilas 1-PDTG (vacío)
							99,   	//Táser de autodefensa (apagado)
							96   	//Batidora eléctrica (apagada)
						], deseInv);
						if(weaponBattery != undefined){
							moveItem(inv.IdInvDes, inv.IdInvPer, battery);
							moveItem(inv.IdInvDes, inv.IdInvPer, weaponBattery);
							await doAction("/api/beyond/desert/action", "POST", {item: weaponBattery, action: getActionIdFromHtml(await doAction("/jx/beyond/partial/desert/actions", "POST", {}), weaponBattery)});
							await doAction("/api/beyond/desert/action", "POST", {item: weaponBattery, action: getActionIdFromHtml(await doAction("/jx/beyond/partial/desert/actions", "POST", {}), weaponBattery)});
							canUseWeaponBattery = true;
						}
					}
					if(!canUseWeaponBattery && (!purge || /^~[0123]:/.test(attackTime))){
						if(currentSaved.usedHeroicAction == undefined){
							if(dataSaved.heroicAction.golpe){
								if((await doAction("https://myhord.es/api/beyond/desert/heroic", "POST", {action: "3"})).error){}else{
									dataSaved.heroicAction.golpe = false;
									currentSaved.usedHeroicAction = true;
									canUseHeroicAction = true;
								}
							}else{
								if(dataSaved.heroicAction.hallazgo){
									if((await doAction("https://myhord.es/api/beyond/desert/heroic", "POST", {action: "2"})).error){}else{// , [PENDIENTE]
										dataSaved.heroicAction.hallazgo = false;
										currentSaved.usedHeroicAction = true;
										canUseHeroicAction = true;
										
										//TODO: usar globo
									}
								}else{
									if(dataSaved.heroicAction.retorno && /^~[0]:/.test(attackTime) /* solo usar cuando queda 1 hora */){ 
										if((await doAction("https://myhord.es/api/beyond/desert/heroic", "POST", {action: "1"})).error){}else{
											dataSaved.heroicAction.retorno = false;
											currentSaved.usedHeroicAction = true;
											canUseHeroicAction = true;
										}
									}else{
										if (/^~[0]:/.test(attackTime)) { // si queda 1 hora o menos acampar
											if(dataSaved.heroicAction.pa){
												if((await doAction("https://myhord.es/api/beyond/desert/heroic", "POST", {action: "4"})).error){}else{
													dataSaved.heroicAction.pa = false;
													currentSaved.usedHeroicAction = true;
													canUseHeroicAction = true;
													// TODO: evaluar si es mejor acampar que gastar esos PAs
													//await doAction("/api/beyond/desert/attack", "POST", {});
													//await doAction("/api/beyond/desert/attack", "POST", {});
													//await doAction("/api/beyond/desert/attack", "POST", {});
												}
											}else{
												const currentPAs = await pag.locator('b[data-incidental-target="ap"]').getAttribute('data-value');
												if(currentSaved.startItems.idInvFood != undefined){
													await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvFood);
												}
												if(currentSaved.startItems.idInvWater != undefined){
													await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvWater);
												}
												if(currentPAs > 0){
													let restPAs = currentPAs;
													for(;restPAs > 0;restPAs--){
														if(restPAs == 1){
															// cavar tumba
															await doAction("/api/beyond/desert/camping ", "POST", {action: "8"});
														}else{
															// mejorar campamento
															await doAction("/api/beyond/desert/camping ", "POST", {action: "7"});
															//await doAction("/api/beyond/desert/camping ", "POST", {action: "6"}); desacampar
														}
													}
												}else{
													// esconderse
													await doAction("/api/beyond/desert/camping ", "POST", {action: "6"});
												}
												dataSaved[`day${currentDay + 1}`] = dataSaved[`day${currentDay}`];
												await goto('/jx/beyond/desert/cached');
												return;
											}
										}
									}
								}
							}
						}
					}
				}
				if(currentSaved.startItems.idInvFood != undefined){
					await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvFood);
				}
				if(currentSaved.startItems.idInvWater != undefined){
					await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvWater);
				}
				currentPoss.purged = true;
				if(!canUseWeapon && !canUseHeroicAction && !canUseWeaponBattery && (!purge || /^~[0123]:/.test(attackTime))){ // TODO: help en foro
					if(dataSaved.postToDay == undefined){
						if(currentSaved.usedHeroicAction == undefined && dataSaved.heroicAction.retorno ){ // aun con retorno
							
						}else{ // ya no tengo retorno
							
						}
						dataSaved.postToDay = true;
					}
				}else{
					await goto('/jx/beyond/desert/cached');
					return await main();
				}
				
				
				// attack with PA: https://myhord.es/api/beyond/desert/attack POST {}
				// attack with AE: https://myhord.es/api/beyond/desert/heroic POST {action: "3"}
				// hallazgo		 : https://myhord.es/api/beyond/desert/heroic POST {action: "2", [PENDIENTE]}
				// retorno del he: https://myhord.es/api/beyond/desert/heroic POST {action: "1"}
				
				// cargar arma	 : https://myhord.es/api/beyond/desert/action POST {item: "26749394", action: "55"} // lanzapilas 1-PDTG
				// attack withCEL: https://myhord.es/api/beyond/desert/action POST {item: "26752892", action: "118"} //ATAQUE CON MOVIL
				
				// abrir maletin : https://myhord.es/api/beyond/desert/action POST {item: "26763264", action: "41"}
				// buscar agua	 : https://myhord.es/api/beyond/desert/action POST {item: "26753478", action: "167"}
				
				// acampar		 : https://myhord.es/api/beyond/desert/camping POST {action: "6"}
				// desacampar	 : https://myhord.es/api/beyond/desert/camping POST {action: "9"}
				// mejorar campam: https://myhord.es/api/beyond/desert/camping POST {action: "7"}
				// cavar una tumb: https://myhord.es/api/beyond/desert/camping POST {action: "8"}
				
			}else{
				// saquear ruina
				const digRuinButton = await pag.locator('#dig_ruin_button');
				if(await digRuinButton.count() > 0 && currentPoss.diggedRuin == undefined){ // urgar ruina
					currentPoss.diggedRuin = true;
					await digRuinButton.click();
					return await main();
				}
				
				// 2. Si es posible escavar se intentará recolectar recursos antes de moverse.
				const digButton = await pag.locator('#dig_button');
				if(await digButton.count() > 0  && currentPoss.digged == undefined){ // escavar
					//await doAction("/api/beyond/desert/dig", "POST", {});
					currentPoss.digged = true;
					await digButton.click();
					//writeJSON(nameFile_dataSaved, dataSaved);
					await goto('/jx/beyond/desert/cached');
					return await main();
				}
				
				// 4. Si faltan 4 horas para el ataque deberá avanzar sin agotar la zona hasta completar la ruta.
				const mgdZoneNote = await pag.locator('#mgd-zone-note').count();
				const attackTime = await pag.locator('div.attack-time').innerText();
				if (await mgdZoneNote > 0 || /^~[3210]:/.test(attackTime) || currentPoss.dried) {// moverse
					// 3. Al moverse si no se cuenta con PA's suficientes deberán consumirse los recursos preparados para la ruta.
					const currentPAs = await pag.locator('b[data-incidental-target="ap"]').getAttribute('data-value');
					if(currentPAs == 0){ // consumir
						let canUseItem = false;
						//comer
						if(currentSaved?.startItems?.idInvFood === undefined || (await doAction("/api/beyond/desert/action", "POST", {item: currentSaved.startItems.idInvFood, action: getActionIdFromHtml(await doAction("/jx/beyond/partial/desert/actions", "POST", {}), currentSaved.startItems.idInvFood)})).error){
							//tomar agua
							if(currentSaved?.startItems?.idInvWater === undefined || (await doAction("/api/beyond/desert/action", "POST", {item: currentSaved.startItems.idInvWater, action: getActionIdFromHtml(await doAction("/jx/beyond/partial/desert/actions", "POST", {}), currentSaved.startItems.idInvWater)})).error){
								// TODO: acción si no logré comer ni tomar agua
							}else{
								currentSaved.startItems.idInvWater = undefined;
								canUseItem = true;
							}
						}else{
							currentSaved.startItems.idInvFood = undefined;
							canUseItem = true;
						}
						if(canUseItem){
							return await main();
						}else{
							// TODO: Avisar que se ha quedado sin PAs y no logró consumir nada
						}
					}else{ // moverse
						// recoger items
						let inv = await getInventoryIds();
						await dropPlayerInventory(inv);
						if(currentSaved.startItems.idInvFood != undefined){
							await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvFood);
						}
						if(currentSaved.startItems.idInvWater != undefined){
							await moveItem(inv.IdInvDes, inv.IdInvPer, currentSaved.startItems.idInvWater);
						}
						dataSaved.invSize = await getInventorySize(inv.IdInvPer);
						let playInv = await getPlayerInventory(inv);
						let deseInv = await getDesertInventory(inv);
						let takeHeavy = true;
						const weaponHeavyList = weaponListData.weaponHeavyList.map(o => o.id);
						const weaponList = weaponListData.weaponList.map(o => o.id);
						while(Object.keys(playInv).length < dataSaved.invSize && Object.keys(deseInv).length != 0){
							if(currentSaved.route.currentPoss <= 4){ // si se encuentra a X PA de distancia, solo toma las armas
								if(takeHeavy){
									let playInvTemp = await searchMoveItem(inv.IdInvDes, inv.IdInvPer, weaponHeavyList);
									if(playInvTemp == undefined){
										takeHeavy = false;
										continue;
									}else{
										dataSaved.invSize = playInvTemp.target.size;
										playInv = await getListItems(playInvTemp.target);
										deseInv = await getListItems(playInvTemp.source);
										takeHeavy = false;
									}
								}else{
									let playInvTemp = await searchMoveItem(inv.IdInvDes, inv.IdInvPer, weaponList);
									if(playInvTemp == undefined){
										break;
									}else{
										dataSaved.invSize = playInvTemp.target.size;
										playInv = await getListItems(playInvTemp.target);
										deseInv = await getListItems(playInvTemp.source);
									}
								}
							}else{
								if(takeHeavy){
									let playInvTemp = await searchMoveItem(inv.IdInvDes, inv.IdInvPer, items.heavyList);
									if(playInvTemp == undefined){
										takeHeavy = false;
										continue;
									}else{
										dataSaved.invSize = playInvTemp.target.size;
										playInv = await getListItems(playInvTemp.target);
										deseInv = await getListItems(playInvTemp.source);
										takeHeavy = false;
									}
								}else{
									let playInvTemp = await searchMoveItem(inv.IdInvDes, inv.IdInvPer, items.list);
									if(playInvTemp == undefined){
										break;
									}else{
										dataSaved.invSize = playInvTemp.target.size;
										playInv = await getListItems(playInvTemp.target);
										deseInv = await getListItems(playInvTemp.source);
									}
								}
							}
						}
						// actualizar GestHordes
						await goto('/jx/beyond/desert/cached');
						await pag.waitForSelector('#header-rucksack-items');
						await updateGestHordes();
						await new Promise(r => setTimeout(r, 2000));
						// ir a la siguiente posición
						const nextPoss = currentSaved.route.way[currentSaved.route.currentPoss + 1];
						if((await doAction("/api/beyond/desert/move", "POST", { x: nextPoss.x, y: nextPoss.y })).error){
							// TODO: acción si no logré moverme
						}else{
							currentSaved.route.currentPoss = currentSaved.route.currentPoss + 1;
							//writeJSON(nameFile_dataSaved, dataSaved);
							await goto('/jx/beyond/desert/cached');
							return await main();
						}
					}
				}
				
			}
		}
	}catch(exception){
		console.log(exception);
		//TODO: ADVERTIR POR TELEGRAM QUE NO FUE POSIBLE EJECUTAR NO°_PASO
	}finally{
		//writeJSON(nameFile_dataSaved, dataSaved);
	}
}

// flujo para aceptar la muerte cuando la partida termina
async function acceptDead(){
	await pag.waitForSelector('button[x-ajax-href="/jx/game/raventimes"]');
	
	dataSaved = {};
	writeJSON(nameFile_dataSaved, dataSaved);
	
	lastWords = readJSON(lastWordsFile);
	//console.log(lastWords);
	await pag.type('#last_words', lastWords.dead[Math.floor(Math.random() * lastWords.dead.length)], { delay: 150 });
	await pag.on('dialog', async dialog => {
		//console.log(`Tipo de diálogo: ${dialog.type()}`);
		//console.log(`Mensaje: ${dialog.message()}`);
		await dialog.accept(); // acepta el alert
	});

	await pag.click('#rebirth_btn');
	await goto('/jx/ghost/welcome');
	return await main();
}

// busca un sitio activo y authentica con las credenciales
async function login(){
	// Se busca servidor activo
	if(!(await nav('https://myhord.es/'))){
		if(!(await nav('https://myhord.de/'))){
			if(!(await nav('https://myhord.eu/'))){
				if(!(await nav('https://myhord.fr/'))){
					//TODO: ACORTAR TIEMPO DE ESPERA PARA LA SIGUIENTE EJECUCIÓN, YA QUE NO SE LOGRÓ EJECUTAR
					return;
				}
			}
		}
	}
	// Se recupera URL base final que si haya logrado responder
	basePath = new URL(pag.url()).origin;
	
	//console.error("Iniciando Login: " + pag.url());
	// Se realiza autenticación
	await goto('/jx/public/login');
	//console.error("Haciendo Login: " + pag.url());
	try{
		await pag.click('#et_login_button', {timeout: 3000});
		await pag.waitForNavigation({ waitUntil: 'domcontentloaded' });
		await pag.type('input[name="login"]', user, { delay: 150 });
		await pag.type('input[name="password"]', pass, { delay: 150 });
		await pag.click('input[name="sign_in"]');
		await pag.waitForSelector('hordes-header-ui', {state: 'attached',timeout: 5000});
		//console.error("Login Terminado: " + pag.url());
	}catch(exception){
		if (exception.name === 'TimeoutError') {
			console.error("Se agotó el tiempo de espera al intentar hacer click");
		} else {
			console.error("Otro error ocurrió:", exception);
		}
	}
}

//flujo para ingresar a un pueblo
async function joinToTown(){
	let townsAvailable = (await doAction("/rest/v1/game/lobby/list", "GET", {})).towns.filter(
	  item => item.type === 2 &&
			  item.language === "es" &&
			  item.coalitions < item.population
	);
	await pag.locator('span.link.bold', { hasText: townsAvailable[0].name }).click();
	await pag.waitForSelector('button.modal-button.small.inline', {state: 'visible', timeout: 5000});

	const buttons = pag.locator('button.modal-button.small.inline');
	const joinButton = buttons.nth(1);
	await pag.waitForFunction(() => {
		const btns = document.querySelectorAll('button.modal-button.small.inline');
		return btns[1] && !btns[1].disabled;
	}, { timeout: 10000 });
	await joinButton.click();

	//await goto('/jx/game/jobcenter');
	await selectJob();
}

// se elije una profecion junto con sus habilidades
async function selectJob(){
	lastDataSaved.idTown = await (await pag.waitForSelector('hordes-town-onboarding', {state: 'attached', timeout: 10000 })).getAttribute('data-town');
	writeJSON(nameFile_lastDataSaved, lastDataSaved);
	// profession id 
	//	0 = 
	//	1 = 
	//	2 = habitante
	//	3 = escavador
	//	4 = guardian
	//	5 = explorador
	//	6 = domador
	//	7 = tecnico
	//	8 = 
	//	9 = hermitaño
	
	// base skills [25, 29, 33, 37, 41]
	
	await doAction("/rest/v1/game/welcome/" + lastDataSaved.idTown, "PATCH", {"identity": null, "profession": {"id": 3}, 
	// TODO: FUNCTION TO UPDATE LAST ID UPGRADES AVAILABLES
	"skills": {"ids": [28, 32, 36, 40, 44]}});
	await new Promise(r => setTimeout(r, 2000));
	await goto('/jx/town/dashboard');
	await new Promise(r => setTimeout(r, 2000));
	return await main();
}

/*
	--------------------------
	UTILERIAS
	--------------------------
*/
// localiza la extensión MHO: instalación local de Edge, caché del repo o descarga desde la Chrome Web Store
async function resolveExtensionPath(){
	const extensionId = 'jolghobcgphmgaiachbipnpiimmgknno';
	// instalación local de Edge (Windows)
	if(process.env.LOCALAPPDATA){
		const basepath = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Extensions', extensionId);
		try {
			const found = fs.readdirSync(basepath, { withFileTypes: true })
				.filter(dirent => dirent.isDirectory())
				.map(dirent => path.join(basepath, dirent.name))[0];
			if(found){
				return found;
			}
		} catch (err) {
			console.error('Error al leer la carpeta:', err);
		}
	}
	// caché de una descarga previa
	const cacheDir = path.join(".", "tests", "extension", extensionId);
	if(fs.existsSync(path.join(cacheDir, 'manifest.json'))){
		return cacheDir;
	}
	// descarga desde la Chrome Web Store
	try {
		const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=126.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
		const response = await fetch(url);
		if(!response.ok){
			throw new Error(`HTTP ${response.status}`);
		}
		const crx = Buffer.from(await response.arrayBuffer());
		// formato CRX3: 'Cr24' + versión + tamaño de cabecera; el zip inicia después de la cabecera
		const headerSize = crx.readUInt32LE(8);
		const zipBuffer = crx.subarray(12 + headerSize);
		new AdmZip(zipBuffer).extractAllTo(cacheDir, true);
		return cacheDir;
	} catch (err) {
		console.error('No fue posible descargar la extensión:', err);
		return undefined;
	}
}
// navegación en url myhordes
async function goto(path){
	let response = await pag.goto(basePath + path);
	if (response && response.status() == 200) {
		return true;
	} else {
		return false;
	}
}
// navegación en url completa
async function nav(url){
	let response = await pag.goto(url);
	if (response && response.status() == 200) {
		return true;
	} else {
		return false;
	}
}
// ejecuta cualquier petición http en MyHordes
async function doAction(endpoint, method, bodyData) {
	const response = await pag.request.fetch(new URL(pag.url()).origin + endpoint, {
		method,
		headers: {
		"Accept": "application/json",
		"Content-Type": "application/json",
		"x-requested-with": "XMLHttpRequest"
		},
		data: (method !== "GET" && method !== "HEAD") ? bodyData : undefined
	});
	const contentType = response.headers()["content-type"];
	let result;
	if (contentType && contentType.includes("application/json")) {
		result = await response.json();
		logTrace(endpoint, method, bodyData, response.status, result);
	} else {
		result = await response.text();
		logTrace(endpoint, method, bodyData);
	}
	return result;
}
// leer JSON desde archivo
function readJSON(filePath) {
	const data = fs.readFileSync(filePath);
	//console.log(data);
	return JSON.parse(data);
}
// escribir JSON en archivo
function writeJSON(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	
	// Agregar y commitear cambios
	try{
		execSync('git config user.name "github-actions[bot]"');
		execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
		execSync(`git add ${filePath}`);
		execSync(`git commit -m "file changed: ${filePath}"`);
		execSync('git pull --rebase https://x-access-token:' + process.env.GITHUB_TOKEN +
		'@github.com/' + process.env.GITHUB_REPOSITORY + '.git main');
		execSync('git push https://x-access-token:' + process.env.GITHUB_TOKEN +
		'@github.com/' + process.env.GITHUB_REPOSITORY + '.git HEAD:main');
		console.log(`Archivo ${filePath} actualizado`);
	} catch(error){
		//console.error(`Error al guardar cambios para archivo ${filePath} en GitHub: `, error.message);
	}
}

// obtiene el tamaño maximo del inventario
async function getInventorySize(idInv){
	if(idInv == undefined){
		return undefined;
	}
	const listItems = await doAction("/rest/v1/game/inventory/" + idInv, "GET", {});
	if(listItems != undefined){
		return listItems.size;
	}else{
		return undefined;
	}
}
// obtiene el listado de items existentes en inventario indicado
async function getInventory(idInv){
	if(idInv == undefined){
		return undefined;
	}
	return await getListItems(await doAction("/rest/v1/game/inventory/" + idInv, "GET", {}));
}
// obtiene el listado de items existentes en inventario indicado
async function getListItems(listItems){
	const items = {};
	if(listItems.categories){
		for (let i = 0; i < listItems.categories.length; i++) {
			let cat = listItems.categories[i];
			for (let j = 0; j < cat.items.length; j++) {
				let item = cat.items[j];
				items[item.i]={c:item.c,p:item.p};
			}
		}
	}else{
		for (let i = 0; i < listItems.items.length; i++) {
			let item = listItems.items[i];
			items[item.i]={c:item.c,p:item.p};
		}
	}
	return items;
}
// obtiene el listado de items existentes en el almacen
async function getStorageInventory(inv) {
	return await getInventory(inv.IdInvSto);
}
// obtiene el listado de items existentes en el inventario del jugador
async function getPlayerInventory(inv) {
	return await getInventory(inv.IdInvPer);
}
// obtiene el listado de items existentes en el baul
async function getBaulInventory(inv) {
	return await getInventory(inv.IdInvBau);
}
// obtiene el listado de items existentes en el desierto
async function getDesertInventory(inv) {
	return await getInventory(inv.IdInvDes);
}

// recupera los ids de los inventarios Personal, Storage y Baul
// @return: inv : {IdInvPer, IdInvSto, IdInvBau, IdInvDes}
async function getInventoryIds() {
	try {
		const inventoryElement = new JSDOM(await doAction("/jx/town/bank", "GET", {})).window.document.querySelector("hordes-inventory");
		if (inventoryElement) {
			const IdInvPer = inventoryElement.getAttribute("data-inventory-a-id");
			if(IdInvPer){
				idPlayerInv = IdInvPer;
			}
			const IdInvSto = inventoryElement.getAttribute("data-inventory-b-id");
			
			const inventoryHouseElement = new JSDOM(await doAction("/jx/town/house/dash", "GET", {})).window.document.querySelector("hordes-inventory");
			if(inventoryHouseElement){
				const IdInvBau = inventoryHouseElement.getAttribute("data-inventory-b-id");
				return { IdInvPer, IdInvSto, IdInvBau };
			} else {
				console.error("No se encontró el elemento <hordes-inventory> en el HTML.");
				return undefined;
			}
		} else {
			console.error("No se encontró el elemento <hordes-inventory> en el HTML.");
			const inventoryElementDesert = new JSDOM(await doAction("/jx/beyond/desert/cached", "POST", {})).window.document.querySelector("hordes-inventory");
			if (inventoryElementDesert) {
				const IdInvPer = inventoryElementDesert.getAttribute("data-inventory-a-id");
				if(IdInvPer){
					idPlayerInv = IdInvPer;
				}
				const IdInvDes = inventoryElementDesert.getAttribute("data-inventory-b-id");
				
				return { IdInvPer, IdInvDes };
			} else {
				console.error("No se encontró el elemento <hordes-inventory> en el HTML.");
				return undefined;
			}
		}
	} catch (error) {
		console.error("Error al obtener los IDs:", error);
	}
			return undefined;
}
// cierra el portal del pueblo
async function closePortal(){
	return await doAction("/rest/v1/game/town/core/door", "PATCH", {action: "close"});
}
// utiliza un objeto del almacen y lo regresa
async function UseAndReturn(inv, storageInventory, item, act){
	let stoInv = searchItemIdInv([item], storageInventory)
	if(stoInv){
		await doAction("/rest/v1/game/inventory/"+inv.IdInvSto+"/"+stoInv, "PATCH", {d: "up", mod: null, to: inv.IdInvPer});
		let plaInv = searchItemIdInv([item], await getPlayerInventory(inv))
		if(plaInv){
			await doAction("/api/town/house/action", "POST", {item: plaInv, action: act});
			//console.log("/rest/v1/game/inventory/"+inv.IdInvPer+"/"+plaInv);
			//console.log({d: "down", mod: null, to: inv.IdInvSto});
			await doAction("/rest/v1/game/inventory/"+inv.IdInvPer+"/"+plaInv, "PATCH", {d: "down", mod: null, to: inv.IdInvSto});
		}
	}
}
function getActionIdFromHtml(htmlText, provokingId) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlText, "text/html");
	const li = doc.querySelector(`li[x-provoking-id="${provokingId}"]`);
	return li ? li.getAttribute("x-action-id") : null;
}

// mueve un objeto entre inventarios
async function moveItem(fromIdInv, toIdInv, id){
	let dir = "";
	if(fromIdInv == idPlayerInv){
		dir = "down";
	}else {
		dir = "up";
	}
	return (await doAction("/rest/v1/game/inventory/"+fromIdInv+"/"+id, "PATCH", {d: dir, mod: null, to: toIdInv}));
}
// busca y mueve un objeto entre inventarios
async function searchMoveItem(fromIdInv, toIdInv, arrItemsToSearch){
	let id = searchItemIdInv(arrItemsToSearch, await getInventory(fromIdInv));
	if(id != undefined){
		return moveItem(fromIdInv, toIdInv, id);
	} else {
		return undefined;
	}
}
// devuelve todo el contenido del inventario Personal al Storage
async function dropPlayerInventory(inv){
	if(inv.IdInvSto != undefined){
		await doAction("/rest/v1/game/inventory/" + inv.IdInvPer, "PATCH", {d: "down-all", mod: null, to: inv.IdInvSto});
	}
	if(inv.IdInvDes != undefined){
		await doAction("/rest/v1/game/inventory/" + inv.IdInvPer, "PATCH", {d: "down-all", mod: null, to: inv.IdInvDes});
	}
}
// recupera objetos del almacen para una exploracion
async function prepareToExplore(inv, storageInventory){
	//tirar inventario
	await doAction("/rest/v1/game/inventory/" + inv.IdInvPer, "PATCH", {d: "down-all", mod: null, to: inv.IdInvSto});
	const waters = items.waters.map(water => water.id);
	if((await doAction("/rest/v1/game/town/facilities/well", "GET", {})).error){
		let idW = searchItemIdInv(waters, storageInventory);
		if(idW){
			await doAction("/rest/v1/game/inventory/"+inv.IdInvSto+"/"+idW, "PATCH", {d: "up", mod: null, to: inv.IdInvPer});
		}
	}
	const foods = items.foods.map(food => food.id);;
	//recoger comida
	let abrelatas = searchItemIdInv([20], storageInventory);
	let idF = searchItemIdInv(abrelatas?foods:foods.slice(1), storageInventory);
	if(idF){
		let actInv = await doAction("/rest/v1/game/inventory/"+inv.IdInvSto+"/"+idF, "PATCH", {d: "up", mod: null, to: inv.IdInvPer});
		if(actInv?.success){
			//evalua si se recogió una lata
			let hasLata = searchItemIdInv([3], actInv.target);
			if(hasLata){
				//recoge abre latas
				actInv = await doAction("/rest/v1/game/inventory/"+inv.IdInvSto+"/"+abrelatas, "PATCH", {d: "up", mod: null, to: inv.IdInvPer});
				if(actInv?.success){
					//abre la lata
					await doAction("/api/town/house/action", "POST", {item: hasLata, action: "12"});
					if(abrelata = searchItemIdInv([20], actAbrLat.target)){
						//regresa el abre latas
						await doAction("/rest/v1/game/inventory/"+inv.IdInvPer+"/"+abrelata, "PATCH", {d: "down", mod: null, to: inv.IdInvSto});
					}
				}else{
					// regresa la lata
					await doAction("/rest/v1/game/inventory/"+inv.IdInvPer+"/"+hasLata, "PATCH", {d: "down", mod: null, to: inv.IdInvSto});
					idF = searchItemIdInv(abrelatas?foods:foods.slice(1), storageInventory);
					actInv = await doAction("/rest/v1/game/inventory/"+inv.IdInvSto+"/"+idF, "PATCH", {d: "up", mod: null, to: inv.IdInvPer});
				}
			}
			//evalua si se recogió un doggybag
			let hasDoggyBag = searchItemIdInv([118], actInv.target);
			if(hasDoggyBag){
				//abre doggy-back
				await doAction("/api/town/house/action", "POST", {item: hasDoggyBag, action: "32"});
			}
		}
	}
	let pI = await getPlayerInventory(inv);
	return {idFood:searchItemId(foods, pI), idWater:searchItemId(waters, pI), idInvFood:searchItemIdInv(foods, pI), idInvWater:searchItemIdInv(waters, pI)}
}
// busca un item en un inventario ya sea Baul, Personal o Storage
function searchItemIdInv(arrItemsToSearch, arrItemsStorage) {
	for (let item in arrItemsStorage) {
		for (let i = 0; i < arrItemsToSearch.length; i++) {
			if(arrItemsToSearch[i] === arrItemsStorage[item].p){
				return item.toString();
			}
		}
	}
	return undefined;
}
function searchItemId(arrItemsToSearch, arrItemsStorage) {
	for (let item in arrItemsStorage) {
		for (let i = 0; i < arrItemsToSearch.length; i++) {
			if(arrItemsToSearch[i] === arrItemsStorage[item].p){
				return arrItemsToSearch[i];
			}
		}
	}
	return undefined;
}
// consulta a gesthordes
async function getGestHordes(){
	const raw = await readFile('./data/gestHordes.json', 'utf-8');
	return JSON.parse(raw);
}
async function getWeaponsGestHordes() {
	const raw = await readFile('./data/weapons.json', 'utf-8');
	return JSON.parse(raw);
}

// actualiza GestHordes
async function updateGestHordes(){
	// activar actualización de herramientas externas
	try{
		if(!externalTools) {
			await pag.waitForSelector('.mho-new-changelog', {timeout: 7000});
			await pag.evaluate(() => {
				return new Promise(resolve => {
					setTimeout(() => {
						const el = document.querySelector('.mho-new-changelog');
						if (el) {
							el.classList.add('mho-btn-opened');
						}
						resolve();
					}, 2000);
				});
			});
			await pag.check('#synchronize_external_tools_input', {timeout: 7000});
			externalTools = true;
		}
	}catch(exception){
		//throw new Error("Error updateGestHordes: " + exception);
		console.log(exception);
	}
	if(externalTools){
		await pag.waitForSelector('#mh-update-external-tools', { state: 'visible', timeout: 7000 });
		await pag.click('#mh-update-external-tools');
		await new Promise(r => setTimeout(r, 7000));
	}
}
// crea una ruta basada en GestHordes
async function getRoute(PAs, tGroupControl = 2){
	console.log(`(PAs: ${PAs})`);
	gestHorderData = await getGestHordes();
	const zones = gestHorderData.data.carte.zones;
	const map = [];
	for (const key in zones) {
		const zone = zones[key];
		const { x, y } = zone;
		if (!map[y]) {
			map[y] = [];
		}
		let totalPeso = 0;
		zone.opt = 
				((zone.dried) ? 0 : 2) // agotada
			+	((zone.bat_id != null && !zone.empty)? 2 : 0) // con ruina sin agotar
			+	(zone.items.forEach(item => totalPeso += items.ruteValue[item.item_id] || 0) || 0) // objetos que vale la pena recoger
		;
		//console.log(`${zone.opt} ${((zone.dried) ? 0 : 2)} ${((zone.bat_id != null && !zone.empty)? 2 : 0)} ${(zone.items.forEach(item => totalPeso += items.ruteValue[item.item_id] || 0) || 0)}`);
		map[y][x] = zone;
	}
/*
	Reglas para genera rutas completas:
		[*] Si el total de PAs es impar redondear a par hacia abajo ( 5 PAs -> 4 PAs, 9 PAs -> 8 PAs ) = Math.floor( 9 / 2 ) * 2
		[*] Si en una ruta se desplaza hacia abajo o hacia arriba, ya no se cambia de dirección hasta pasado la mitad de los PAs (ruta de retorno)
		[*] Si en una ruta se desplaza hacia la izquierda o derecha, ya no se cambia de dirección hasta pasado la mitad de los PAs (ruta de retorno)
		[*] (analizando) Si la ruta inicia en una dirección el ultimo movimiento no puede ser en esa misma dirección
	
	Reglas para generar rutas seguras:
		[-] El total de control del equipo debe ser mayor o igual a la predicción maxima de zombies en cada celda del recorrido
		Primeros días:
			(evaluar como reaccionar) Si la zona tiene un minimo (1 o 2) de zombies el riesgo de contener zombies proximos es mayor
				posibles acciones:
					[-] Si el jugador aun tiene golpe para reducir el total de zombies es posible el desplazamiento
					[-] Si el jugador ya no tiene golpe deberá evaluarse la información de las 8 casillas adyacentes para determinar la dirección mas segura (la que contendrá menos zombies en la predicción)
		Mediados días y posterior:
			[-] No pasar si la zona proxima no ha sido explorada y en la celda actual de la ruta ya se alcanzo el control del grupo

	Reglas para generar rutas optimas (no agotadas):
		[ ] Rutas con ruinas aún disponibles suman 1 recolección adicional
		[ ] Utilizar el contador de cabadas totales faltantes para medir cuanto falta para agotar en total cada ruta
		[ ] Primeros días (1 - 2) al menos el 80% de las zonas no estan agotadas
		[ ] Mediados días (3 - 4) al menos el 55% de las zonas no estan agotadas
		[ ] Mediados días (5 - 6) al menos el 25% de las zonas no estan agotadas
	
	Reglas para ciudades largas:
		[ ] Si se excede el día 7, deberá hacerse ruta solo si se cumplen las reglas mas exigentes de seguridad y de optimización
*/
	// Se cierra el total de PAs a un numero par
	const tPAs = Math.floor( PAs / 2 ) * 2;
	
	// Pasos:
	// 1. se generan todas las rutas posibles en cada dirección con los PAs indicados usando (Reglas para genera rutas completas)
	createRoutes(tPAs);
	
	// 2. se ponderan las rutas y se recupera la mas alta
	const village = getVillageInfo();
	//console.log(village);
	let rutaOpt = {way:[]};
	let tFOpt = -1;
	for await (const chunk of loadRoutesInChunks(path.join(constFile, `routes_${tPAs}.json`), 32)) {
		// Procesar rutas en paralelo dentro del chunk
		const resultados = await Promise.all(chunk.map(async (ruta) => {
			let tOpt = 0;
        	let zonePrev = undefined;
			for (let p of ruta) {
				try {
					const zone = map[p[1] + village.y][p[0] + village.x];
					tOpt += zone.opt;
					// Usa la estimación para el primer limpiado, si no hay estimación deja la ruta, hasta el momento se descartan todas las completamente inseguras
					if(zone.zombie_estim != null && zone.zombie_estim > tGroupControl){
						return { tOpt: -1, ruta: {}};
					}
					// TODO: no ejecutarse si aun esta disponible el golpe
        			if(zonePrev != undefined && zone.zombie_estim == null){
                        if(zonePrev.zombie_estim != null && zonePrev.zombie_estim > 0){
							return { tOpt: -1, ruta: {}};
                        }
                    }
					zonePrev = zone;
				} catch (exception ){
					//console.log(`y:${p[1] + village.y}, x:${p[0] + village.x}`);
					return { tOpt: -1, ruta: {}};
				}
			}
			return { tOpt, ruta };
		}));
		let rutaOptTemp = [];
		// Reducir resultados parciales
		for (let { tOpt, ruta } of resultados) {
			if (tOpt > tFOpt) {
				tFOpt = tOpt;
				rutaOptTemp = ruta;
			}
		}
		let possWay = 0;
		for (let p of rutaOptTemp) {
			rutaOpt.way[possWay] = {x:p[0], y:p[1]};
			possWay++;
		}
		
	}
	// 3. agrega cuenta e información de zonas agotadas para determinar segun el día actual si vale la pena hacer o no la ruta
	//console.log(rutaOpt);
	rutaOpt.tNotDried = -2;
	for (let p of rutaOpt.way) {
		p.dried = map[p.y + village.y][p.x + village.x].dried;
		if(!map[p.y + village.y][p.x + village.x].dried){
			rutaOpt.tNotDried++;
		}
		if(p.dried == null){
			p.dried = false;
		}
	}
	rutaOpt.currentPoss = 0;
	return rutaOpt;
}

/*
test('route', async ({ page }) => {
	createRoutes(4);
	createRoutes(6);
	createRoutes(8);
	createRoutes(10);
	createRoutes(12);
	createRoutes(14);
	createRoutes(16);
	//createRoutes(18);
	//createRoutes(20);
	//createRoutes(22);

	//createRoutes(24);
	//createRoutes(26);
	//createRoutes(28);
	//createRoutes(30);
	//createRoutes(32);
	//createRoutes(34);
	//createRoutes(36);
	//createRoutes(38);
	//createRoutes(40);
	
	let PAs = 8;
	for await (const chunk of loadRoutesInChunks(path.join(constFile, `routes_${PAs}.json`), 32)) {
		for (let ruta of chunk) {
			for (let p of ruta) {
				
				console.log(`(${p[0]}, ${p[1]})`);
			}
		}
	}
});
*/
//Crea todas las rutas posibles existentes con la cantidad de PA dados desde el origen indicado
function* generateRoutesGen(PAs, Ox = 0, Oy = 0, x = 0, y = 0, currentPA = 0, path = [], visited = new Set(), seenRoutes = new Set()) {
    if (currentPA === PAs) {
        if (Ox === x && Oy === y) {
            let fullPath = [...path, [x,y]];
            let routeKey = fullPath.map(p => `${p[0]},${p[1]}`).join("|");
            let reverseKey = [...fullPath].reverse().map(p => `${p[0]},${p[1]}`).join("|");
            if (seenRoutes.has(reverseKey)) {
                return;
            }

            seenRoutes.add(routeKey);
            yield fullPath;
        }
        return;
    }

    let moves = [
        {dx: 1, dy: 0},   // derecha
        {dx: -1, dy: 0},  // izquierda
        {dx: 0, dy: 1},   // arriba
        {dx: 0, dy: -1}   // abajo
    ];

    for (let move of moves) {
        let newX = x + move.dx;
        let newY = y + move.dy;

        let posKey = `${newX},${newY}`;
        if (visited.has(posKey)) {
            continue;
        }

        let newPath = [...path, [x,y]];
        let newVisited = new Set(visited);
        newVisited.add(posKey);

        yield* generateRoutesGen(PAs, Ox, Oy, newX, newY, currentPA+1, newPath, newVisited, seenRoutes);
    }
}
// Función envolvente con persistencia
function createRoutes(PAs, Ox = 0, Oy = 0) {
    const filePath = path.join(constFile, `routes_${PAs}.json`);
    if (fs.existsSync(filePath)) {
        return {};
    } else {
		const stream = fs.createWriteStream(filePath);
		let count = 0;
		for (let ruta of generateRoutesGen(PAs, Ox, Oy)) {
			stream.write(JSON.stringify(ruta) + '\n');
			count++;
		}
		stream.end();
        return {};
    }
}
async function* loadRoutesInChunks(filename, chunkSize = 100) {
    const fileStream = fs.createReadStream(filename);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let buffer = [];
    for await (const line of rl) {
        if (line.trim().length === 0) continue; // saltar líneas vacías
        buffer.push(JSON.parse(line));
        if (buffer.length === chunkSize) {
            yield buffer;
            buffer = [];
        }
    }
    if (buffer.length > 0) {
        yield buffer; // último bloque
    }
}
// Recupera información de la villa
function getVillageInfo(){
	if(gestHorderData == undefined){
		return undefined;
	}
	const ville = gestHorderData.data.general.ville;
	const sizeX = ville.width;
	const sizeY = ville.height;
	const villX = ville.pos_x;
	const villY = ville.pos_y;
	return {maxX: sizeX - villX - 1 , maxY: sizeY - villY, minX: -villX, minY: -villY + 1, x: villX, y: villY }
}
// Función para generar todas las combinaciones posibles
function generateCombinations(arr) {
  const result = [];
  const n = arr.length;
  for (let i = 1; i < (1 << n); i++) {
    const combo = [];
    for (let j = 0; j < n; j++) {
      if (i & (1 << j)) combo.push(arr[j]);
    }
    result.push(combo);
  }
  return result;
}
function searchAvailableObjects(obj, list) {
  const available = [];

  for (const [key, inv] of Object.entries(obj)) {
    const found = list.find(o => o.id === inv.p);
    if (found) {
      available.push({
        key,        // clave original del inventario
        ...inv,     // datos del inventario
        ...found // datos kill_min/kill_max
      });
    }
  }

  return available;
}
// Función para encontrar la combinación más cercana al objetivo totalKills
function findClosestWeaponsCombination(list, totalKills, inv) {
  const combinations = generateCombinations(searchAvailableObjects(inv, list));
  let best = null;
  let differenceMin = Infinity;

  for (const combo of combinations) {
    // Validar que todos los objetos estén en inventario
    const allexist = combo.every(obj =>
      Object.values(inv).some(inv => inv.p === parseInt(obj.id, 10))
    );
    if (!allexist) continue;

    // Calcular promedio conjunto
      
    const chanceKill = (combo.reduce((acc, o) => acc + (o.chance_kill / 100), 0) / combo.length);
    const averageRounded = Math.floor(combo.reduce((acc, o) => acc + ((o.kill_min + o.kill_max) / 2), 0)) * chanceKill;

    const difference = Math.abs(averageRounded - totalKills);
    
    if (difference < differenceMin || 
       (difference === differenceMin && averageRounded <= totalKills)) {
      differenceMin = difference;
      best = { combo, average: averageRounded };
    }
  }

  return best;
}
function logTrace(url, method, body = undefined, status = undefined, result = undefined) {
	if(dataSaved.log == undefined){
		dataSaved.log = {};
	}
	const currentDate = getFormattedDate();
	dataSaved.log[currentDate] = {
		request: {
			url: url,
			method: method,
			body: body
		},
		response: {
			status: status,
			body: result
		}
	};
	//console.log(dataSaved.log[currentDate]);
	//writeJSON(nameFile_dataSaved, dataSaved);
}

function getFormattedDate() {
	const d = new Date();
	
	const yyyy = d.getFullYear();
	const mm = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
	const dd = (d.getDate() < 10 ? '0' : '') + d.getDate();
	
	const hh = (d.getHours() < 10 ? '0' : '') + d.getHours();
	const ii = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
	const ss = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
	const millis = (d.getMilliseconds() < 100 ? (d.getMilliseconds() < 10 ? '00' : '0') : '') + d.getMilliseconds();
	
	return `${yyyy}${mm}${dd}_${hh}${ii}${ss}_${millis}`;
}
