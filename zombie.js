// ========================================
// SYSTÈME DE BOSS ET ENNEMIS SPÉCIAUX
// ========================================

class BossSystem {
    constructor(scene, playerGroup) {
        this.scene = scene;
        this.playerGroup = playerGroup;
        this.bosses = [];
        this.specialZombies = [];
    }

    // Créer un boss zombie géant
    createBoss(wave) {
        const bossGroup = new THREE.Group();

        // Corps massif du boss
        const bossBodyGeometry = new THREE.BoxGeometry(4, 6, 2);
        const bossBodyMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a0a0a,
            emissive: 0x330000,
            emissiveIntensity: 0.2
        });
        const bossBody = new THREE.Mesh(bossBodyGeometry, bossBodyMaterial);
        bossBody.position.y = 5;
        bossBody.castShadow = true;
        bossGroup.add(bossBody);

        // Tête du boss avec cornes
        const bossHeadGeometry = new THREE.SphereGeometry(1.5, 16, 16);
        const bossHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x2a1515 });
        const bossHead = new THREE.Mesh(bossHeadGeometry, bossHeadMaterial);
        bossHead.position.y = 9;
        bossHead.castShadow = true;
        bossGroup.add(bossHead);

        // Cornes
        const hornGeometry = new THREE.ConeGeometry(0.3, 1.5, 4);
        const hornMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
        leftHorn.position.set(-0.7, 10, 0);
        leftHorn.rotation.z = -0.3;
        bossGroup.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeometry, hornMaterial);
        rightHorn.position.set(0.7, 10, 0);
        rightHorn.rotation.z = 0.3;
        bossGroup.add(rightHorn);

        // Yeux brillants
        const eyeGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1
        });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.5, 9, 1.3);
        bossGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.5, 9, 1.3);
        bossGroup.add(rightEye);

        // Bras musclés
        const armGeometry = new THREE.BoxGeometry(1, 5, 1);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0x2a1515 });
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-3, 5, 0);
        leftArm.castShadow = true;
        bossGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(3, 5, 0);
        rightArm.castShadow = true;
        bossGroup.add(rightArm);

        // Jambes
        const legGeometry = new THREE.BoxGeometry(1.2, 4, 1.2);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x1a0a0a });
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-1, 1.5, 0);
        leftLeg.castShadow = true;
        bossGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(1, 1.5, 0);
        rightLeg.castShadow = true;
        bossGroup.add(rightLeg);

        // Position aléatoire loin du joueur
        const angle = Math.random() * Math.PI * 2;
        const distance = 60;
        bossGroup.position.set(
            Math.cos(angle) * distance,
            0.5,
            Math.sin(angle) * distance
        );

        bossGroup.userData = {
            type: 'boss',
            health: 200 + (wave * 50),
            maxHealth: 200 + (wave * 50),
            speed: 0.08,
            damage: 15,
            attackCooldown: 0,
            specialAttackCooldown: 0,
            phase: 1,
            rage: false
        };

        this.scene.add(bossGroup);
        this.bosses.push(bossGroup);

        // Annonce du boss
        this.announceBoss();

        return bossGroup;
    }

    // Zombie rapide
    createSpeedZombie(x, z) {
        const zombieGroup = new THREE.Group();

        // Corps mince
        const bodyGeometry = new THREE.BoxGeometry(1.2, 2.5, 0.7);
        const bodyMaterial = new THREE.MeshLambertMaterial({
            color: 0x4a7c59,
            emissive: 0x00ff00,
            emissiveIntensity: 0.1
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3;
        body.castShadow = true;
        zombieGroup.add(body);

        // Tête
        const headGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0x6b9969 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 4.8;
        head.castShadow = true;
        zombieGroup.add(head);

        // Yeux verts brillants
        const eyeGeometry = new THREE.SphereGeometry(0.1, 6, 6);
        const eyeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 1
        });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.2, 4.8, 0.4);
        zombieGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.2, 4.8, 0.4);
        zombieGroup.add(rightEye);

        zombieGroup.position.set(x, 0.5, z);

        zombieGroup.userData = {
            type: 'speed',
            health: 20,
            speed: 0.25,
            damage: 3,
            attackCooldown: 0,
            dodgeChance: 0.3
        };

        this.scene.add(zombieGroup);
        this.specialZombies.push(zombieGroup);

        return zombieGroup;
    }

    // Zombie tank (résistant)
    createTankZombie(x, z) {
        const zombieGroup = new THREE.Group();

        // Corps épais avec armure
        const bodyGeometry = new THREE.BoxGeometry(3, 3.5, 1.5);
        const bodyMaterial = new THREE.MeshLambertMaterial({
            color: 0x3d3d3d,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3.5;
        body.castShadow = true;
        zombieGroup.add(body);

        // Plaques d'armure
        const plateGeometry = new THREE.BoxGeometry(3.2, 1, 0.2);
        const plateMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            shininess: 100
        });
        const frontPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        frontPlate.position.set(0, 3.5, 0.9);
        zombieGroup.add(frontPlate);

        // Tête avec casque
        const headGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 6;
        head.castShadow = true;
        zombieGroup.add(head);

        zombieGroup.position.set(x, 0.5, z);

        zombieGroup.userData = {
            type: 'tank',
            health: 100,
            speed: 0.04,
            damage: 8,
            attackCooldown: 0,
            armor: 5
        };

        this.scene.add(zombieGroup);
        this.specialZombies.push(zombieGroup);

        return zombieGroup;
    }

    // Zombie explosif
    createExploderZombie(x, z) {
        const zombieGroup = new THREE.Group();

        // Corps gonflé
        const bodyGeometry = new THREE.SphereGeometry(1.5, 8, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({
            color: 0x8b0000,
            emissive: 0xff4444,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3;
        body.castShadow = true;
        zombieGroup.add(body);

        // TNT attaché
        const tntGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.5);
        const tntMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        for (let i = 0; i < 3; i++) {
            const tnt = new THREE.Mesh(tntGeometry, tntMaterial);
            tnt.position.set(
                Math.cos(i * Math.PI * 2 / 3) * 1.5,
                3,
                Math.sin(i * Math.PI * 2 / 3) * 1.5
            );
            zombieGroup.add(tnt);
        }

        zombieGroup.position.set(x, 0.5, z);

        zombieGroup.userData = {
            type: 'exploder',
            health: 30,
            speed: 0.12,
            damage: 30,
            attackCooldown: 0,
            explodeRadius: 10,
            isExploding: false
        };

        this.scene.add(zombieGroup);
        this.specialZombies.push(zombieGroup);

        return zombieGroup;
    }

    announceBoss() {
        const announcement = document.createElement('div');
        announcement.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            color: #ff0000;
            font-size: 48px;
            font-weight: bold;
            text-shadow: 0 0 20px rgba(255,0,0,0.8);
            z-index: 1000;
            animation: pulse 1s infinite;
        `;
        announcement.textContent = '⚠️ BOSS APPARAÎT ⚠️';
        document.body.appendChild(announcement);

        setTimeout(() => announcement.remove(), 3000);
    }

    updateBoss(boss, playerPosition, deltaTime) {
        if (!boss.userData) return;

        const distance = boss.position.distanceTo(playerPosition);
        const direction = new THREE.Vector3();
        direction.subVectors(playerPosition, boss.position);
        direction.y = 0;
        direction.normalize();

        // Phases du boss selon sa santé
        const healthPercent = boss.userData.health / boss.userData.maxHealth;
        if (healthPercent < 0.3 && boss.userData.phase === 1) {
            boss.userData.phase = 2;
            boss.userData.rage = true;
            boss.userData.speed *= 1.5;
            boss.userData.damage *= 1.5;

            // Effet de rage
            boss.children[0].material.emissive = new THREE.Color(0xff0000);
            boss.children[0].material.emissiveIntensity = 0.5;
        }

        // Mouvement
        if (distance > 4) {
            boss.position.x += direction.x * boss.userData.speed;
            boss.position.z += direction.z * boss.userData.speed;
            boss.lookAt(playerPosition);
        }

        // Attaque spéciale - Onde de choc
        if (boss.userData.specialAttackCooldown <= 0 && distance < 15) {
            this.bossShockwave(boss.position);
            boss.userData.specialAttackCooldown = 5;
        }

        boss.userData.specialAttackCooldown -= deltaTime;
        boss.userData.attackCooldown -= deltaTime;
    }

    bossShockwave(position) {
        // Créer une onde de choc qui fait des dégâts
        const shockwaveGeometry = new THREE.RingGeometry(0.1, 15, 32);
        const shockwaveMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
        shockwave.position.copy(position);
        shockwave.rotation.x = -Math.PI / 2;

        this.scene.add(shockwave);

        let scale = 0.1;
        const expandInterval = setInterval(() => {
            scale += 0.5;
            shockwave.scale.set(scale, scale, 1);
            shockwave.material.opacity -= 0.05;

            // Vérifier les dégâts au joueur
            const distance = this.playerGroup.position.distanceTo(position);
            if (distance < scale * 15 && distance > (scale - 0.5) * 15) {
                // Appliquer des dégâts (à connecter avec le système de santé principal)
                window.dispatchEvent(new CustomEvent('bossDamage', { detail: { damage: 10 } }));
            }

            if (shockwave.material.opacity <= 0) {
                clearInterval(expandInterval);
                this.scene.remove(shockwave);
            }
        }, 30);
    }

    explodeZombie(zombie) {
        // Explosion massive
        const explosionGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 1
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(zombie.position);

        this.scene.add(explosion);

        let scale = 0.1;
        const expandInterval = setInterval(() => {
            scale += 1;
            explosion.scale.set(scale, scale, scale);
            explosion.material.opacity -= 0.05;
            explosion.material.color = new THREE.Color(
                1,
                1 - scale * 0.05,
                0
            );

            if (explosion.material.opacity <= 0) {
                clearInterval(expandInterval);
                this.scene.remove(explosion);
            }
        }, 30);

        // Particules d'explosion
        for (let i = 0; i < 30; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff0000 : 0xff6600
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(zombie.position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );

            this.scene.add(particle);

            const moveInterval = setInterval(() => {
                particle.position.add(velocity);
                velocity.y -= 0.05;
                particle.rotation.x += 0.2;
                particle.rotation.y += 0.2;

                if (particle.position.y < -5) {
                    clearInterval(moveInterval);
                    this.scene.remove(particle);
                }
            }, 30);
        }
    }
}

// ========================================
// SYSTÈME DE COMPÉTENCES ET SORTS
// ========================================

class SkillSystem {
    constructor(scene, playerGroup) {
        this.scene = scene;
        this.playerGroup = playerGroup;
        this.skills = {
            fireball: { cooldown: 0, maxCooldown: 5, damage: 50, manaCost: 20 },
            heal: { cooldown: 0, maxCooldown: 10, healAmount: 50, manaCost: 30 },
            shield: { cooldown: 0, maxCooldown: 15, duration: 5, manaCost: 25 },
            lightning: { cooldown: 0, maxCooldown: 8, damage: 30, manaCost: 15 },
            teleport: { cooldown: 0, maxCooldown: 3, range: 20, manaCost: 10 }
        };
        this.mana = 100;
        this.maxMana = 100;
        this.shieldActive = false;
        this.shieldDuration = 0;

        this.createUI();
    }

    createUI() {
        const skillBar = document.createElement('div');
        skillBar.id = 'skillBar';
        skillBar.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 100;
        `;

        const skills = [
            { key: '1', name: 'Boule de feu', icon: '🔥' },
            { key: '2', name: 'Soin', icon: '💚' },
            { key: '3', name: 'Bouclier', icon: '🛡️' },
            { key: '4', name: 'Foudre', icon: '⚡' },
            { key: '5', name: 'Téléportation', icon: '✨' }
        ];

        skills.forEach(skill => {
            const skillSlot = document.createElement('div');
            skillSlot.style.cssText = `
                width: 60px;
                height: 60px;
                background: rgba(0,0,0,0.8);
                border: 2px solid #444;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                position: relative;
            `;
            skillSlot.innerHTML = `
                ${skill.icon}
                <span style="font-size: 10px; position: absolute; top: 2px; left: 2px;">${skill.key}</span>
                <div class="cooldown" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.7);
                    border-radius: 6px;
                    display: none;
                "></div>
            `;
            skillBar.appendChild(skillSlot);
        });

        document.body.appendChild(skillBar);

        // Barre de mana
        const manaBar = document.createElement('div');
        manaBar.style.cssText = `
            position: fixed;
            bottom: 150px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 20px;
            background: rgba(0,0,0,0.5);
            border: 2px solid #00f;
            border-radius: 10px;
            z-index: 100;
        `;
        manaBar.innerHTML = `
            <div id="manaFill" style="
                height: 100%;
                background: linear-gradient(90deg, #0066ff, #00ccff);
                border-radius: 8px;
                transition: width 0.3s;
                width: 100%;
            "></div>
        `;
        document.body.appendChild(manaBar);
    }

    castFireball(targetDirection) {
        if (this.skills.fireball.cooldown > 0 || this.mana < this.skills.fireball.manaCost) return;

        this.mana -= this.skills.fireball.manaCost;
        this.skills.fireball.cooldown = this.skills.fireball.maxCooldown;

        // Créer la boule de feu
        const fireballGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const fireballMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            emissive: 0xff0000,
            emissiveIntensity: 1
        });
        const fireball = new THREE.Mesh(fireballGeometry, fireballMaterial);
        fireball.position.copy(this.playerGroup.position);
        fireball.position.y += 3;

        // Ajouter une traînée de feu
        const trail = [];
        for (let i = 0; i < 5; i++) {
            const trailGeometry = new THREE.SphereGeometry(0.3 - i * 0.05, 4, 4);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.8 - i * 0.15
            });
            const trailPart = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.push(trailPart);
            this.scene.add(trailPart);
        }

        // Lumière de la boule de feu
        const fireLight = new THREE.PointLight(0xff4500, 2, 10);
        fireball.add(fireLight);

        this.scene.add(fireball);

        // Animation et déplacement
        const velocity = targetDirection.clone().normalize().multiplyScalar(1);
        const animate = () => {
            fireball.position.add(velocity);

            // Mettre à jour la traînée
            trail.forEach((part, index) => {
                if (index === 0) {
                    part.position.copy(fireball.position);
                } else {
                    part.position.lerp(trail[index - 1].position, 0.5);
                }
            });

            // Particules de feu
            if (Math.random() < 0.5) {
                const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
                const particleMaterial = new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0xff0000 : 0xffaa00,
                    transparent: true,
                    opacity: 0.8
                });
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.position.copy(fireball.position);
                this.scene.add(particle);

                setTimeout(() => this.scene.remove(particle), 500);
            }

            // Vérifier les collisions (à implémenter avec les zombies)
            // ...

            if (fireball.position.length() > 100) {
                this.scene.remove(fireball);
                trail.forEach(part => this.scene.remove(part));
            } else {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    castHeal() {
        if (this.skills.heal.cooldown > 0 || this.mana < this.skills.heal.manaCost) return;

        this.mana -= this.skills.heal.manaCost;
        this.skills.heal.cooldown = this.skills.heal.maxCooldown;

        // Effet de soin
        window.dispatchEvent(new CustomEvent('heal', { detail: { amount: this.skills.heal.healAmount } }));

        // Particules de soin
        for (let i = 0; i < 20; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(this.playerGroup.position);
            particle.position.x += (Math.random() - 0.5) * 2;
            particle.position.z += (Math.random() - 0.5) * 2;

            this.scene.add(particle);

            const startY = particle.position.y;
            const floatUp = setInterval(() => {
                particle.position.y += 0.1;
                particle.rotation.x += 0.1;
                particle.rotation.y += 0.1;
                particle.material.opacity -= 0.02;

                if (particle.position.y > startY + 5) {
                    clearInterval(floatUp);
                    this.scene.remove(particle);
                }
            }, 30);
        }

        // Aura de soin
        const auraGeometry = new THREE.RingGeometry(0.1, 3, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const aura = new THREE.Mesh(auraGeometry, auraMaterial);
        aura.position.copy(this.playerGroup.position);
        aura.rotation.x = -Math.PI / 2;

        this.scene.add(aura);

        let scale = 0.1;
        const expandInterval = setInterval(() => {
            scale += 0.2;
            aura.scale.set(scale, scale, 1);
            aura.material.opacity -= 0.05;

            if (aura.material.opacity <= 0) {
                clearInterval(expandInterval);
                this.scene.remove(aura);
            }
        }, 30);
    }

    castShield() {
        if (this.skills.shield.cooldown > 0 || this.mana < this.skills.shield.manaCost) return;

        this.mana -= this.skills.shield.manaCost;
        this.skills.shield.cooldown = this.skills.shield.maxCooldown;
        this.shieldActive = true;
        this.shieldDuration = this.skills.shield.duration;

        // Créer le bouclier visuel
        const shieldGeometry = new THREE.SphereGeometry(3, 16, 16);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.copy(this.playerGroup.position);

        this.scene.add(shield);
        this.currentShield = shield;

        // Animation du bouclier
        const animateShield = () => {
            if (this.shieldDuration > 0) {
                shield.position.copy(this.playerGroup.position);
                shield.rotation.y += 0.02;
                shield.material.opacity = 0.3 + Math.sin(Date.now() * 0.005) * 0.1;
                requestAnimationFrame(animateShield);
            } else {
                this.scene.remove(shield);
                this.shieldActive = false;
            }
        };
        animateShield();
    }

    castLightning(target) {
        if (this.skills.lightning.cooldown > 0 || this.mana < this.skills.lightning.manaCost) return;

        this.mana -= this.skills.lightning.manaCost;
        this.skills.lightning.cooldown = this.skills.lightning.maxCooldown;

        // Créer l'éclair
        const lightningGeometry = new THREE.CylinderGeometry(0.1, 0.5, 30, 4);
        const lightningMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffffff,
            emissiveIntensity: 1
        });
        const lightning = new THREE.Mesh(lightningGeometry, lightningMaterial);
        lightning.position.copy(target);
        lightning.position.y = 15;

        // Flash lumineux
        const flash = new THREE.PointLight(0xffffff, 10, 50);
        flash.position.copy(target);
        flash.position.y = 10;
        this.scene.add(flash);

        this.scene.add(lightning);

        // Animation de l'éclair
        let frame = 0;
        const animateLightning = () => {
            frame++;
            lightning.material.opacity = Math.random();
            lightning.rotation.y = Math.random() * Math.PI;

            if (frame > 10) {
                this.scene.remove(lightning);
                this.scene.remove(flash);
            } else {
                requestAnimationFrame(animateLightning);
            }
        };
        animateLightning();

        // Dégâts de zone
        window.dispatchEvent(new CustomEvent('lightningStrike', {
            detail: { position: target, damage: this.skills.lightning.damage, radius: 5 }
        }));
    }

    castTeleport(direction) {
        if (this.skills.teleport.cooldown > 0 || this.mana < this.skills.teleport.manaCost) return;

        this.mana -= this.skills.teleport.manaCost;
        this.skills.teleport.cooldown = this.skills.teleport.maxCooldown;

        // Effet de départ
        this.createTeleportEffect(this.playerGroup.position.clone());

        // Téléportation
        const teleportDistance = this.skills.teleport.range;
        this.playerGroup.position.x += direction.x * teleportDistance;
        this.playerGroup.position.z += direction.z * teleportDistance;

        // Effet d'arrivée
        setTimeout(() => {
            this.createTeleportEffect(this.playerGroup.position.clone());
        }, 100);
    }

    createTeleportEffect(position) {
        // Particules de téléportation
        for (let i = 0; i < 30; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 3;
            particle.position.y += Math.random() * 4;
            particle.position.z += (Math.random() - 0.5) * 3;

            this.scene.add(particle);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 0.2
            );

            const animateParticle = () => {
                particle.position.add(velocity);
                particle.rotation.x += 0.1;
                particle.rotation.y += 0.1;
                particle.material.opacity -= 0.02;

                if (particle.material.opacity > 0) {
                    requestAnimationFrame(animateParticle);
                } else {
                    this.scene.remove(particle);
                }
            };
            animateParticle();
        }
    }

    update(deltaTime) {
        // Mise à jour des cooldowns
        for (let skill in this.skills) {
            if (this.skills[skill].cooldown > 0) {
                this.skills[skill].cooldown -= deltaTime;
            }
        }

        // Régénération de mana
        this.mana = Math.min(this.maxMana, this.mana + deltaTime * 5);
        document.getElementById('manaFill').style.width = (this.mana / this.maxMana * 100) + '%';

        // Mise à jour du bouclier
        if (this.shieldActive) {
            this.shieldDuration -= deltaTime;
        }

        // Mise à jour de l'UI des cooldowns
        const skillSlots = document.querySelectorAll('#skillBar > div');
        const skillNames = ['fireball', 'heal', 'shield', 'lightning', 'teleport'];

        skillNames.forEach((skillName, index) => {
            const cooldownDiv = skillSlots[index].querySelector('.cooldown');
            if (this.skills[skillName].cooldown > 0) {
                cooldownDiv.style.display = 'block';
                cooldownDiv.style.opacity = this.skills[skillName].cooldown / this.skills[skillName].maxCooldown;
            } else {
                cooldownDiv.style.display = 'none';
            }
        });
    }
}

// ========================================
// SYSTÈME MÉTÉO ET CYCLE JOUR/NUIT
// ========================================

class WeatherSystem {
    constructor(scene) {
        this.scene = scene;
        this.currentWeather = 'clear';
        this.rainParticles = [];
        this.fogDensity = 0.01;
        this.timeOfDay = 12; // 0-24 heures
        this.dayDuration = 120; // secondes pour un jour complet

        this.initWeather();
    }

    initWeather() {
        // Initialiser le brouillard
        this.scene.fog = new THREE.Fog(0x444444, 10, 300);

        // Créer les particules de pluie
        this.rainGeometry = new THREE.BufferGeometry();
        const rainVertices = [];

        for (let i = 0; i < 1000; i++) {
            rainVertices.push(
                Math.random() * 200 - 100,
                Math.random() * 100,
                Math.random() * 200 - 100
            );
        }

        this.rainGeometry.setAttribute('position',
            new THREE.Float32BufferAttribute(rainVertices, 3)
        );

        this.rainMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.3,
            transparent: true,
            opacity: 0.6
        });

        this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial);
        this.rain.visible = false;
        this.scene.add(this.rain);

        // Système de nuages
        this.createClouds();
    }

    createClouds() {
        this.clouds = [];

        for (let i = 0; i < 5; i++) {
            const cloudGroup = new THREE.Group();

            // Créer un nuage avec plusieurs sphères
            for (let j = 0; j < 6; j++) {
                const cloudPartGeometry = new THREE.SphereGeometry(
                    Math.random() * 5 + 3,
                    8,
                    6
                );
                const cloudPartMaterial = new THREE.MeshLambertMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.7
                });
                const cloudPart = new THREE.Mesh(cloudPartGeometry, cloudPartMaterial);
                cloudPart.position.set(
                    Math.random() * 10 - 5,
                    Math.random() * 3,
                    Math.random() * 10 - 5
                );
                cloudGroup.add(cloudPart);
            }

            cloudGroup.position.set(
                Math.random() * 200 - 100,
                50 + Math.random() * 20,
                Math.random() * 200 - 100
            );

            this.clouds.push(cloudGroup);
            this.scene.add(cloudGroup);
        }
    }

    setWeather(weather) {
        this.currentWeather = weather;

        switch(weather) {
            case 'rain':
                this.rain.visible = true;
                this.scene.fog.far = 150;
                this.clouds.forEach(cloud => {
                    cloud.children.forEach(part => {
                        part.material.color = new THREE.Color(0x666666);
                    });
                });
                break;

            case 'storm':
                this.rain.visible = true;
                this.scene.fog.far = 100;
                this.clouds.forEach(cloud => {
                    cloud.children.forEach(part => {
                        part.material.color = new THREE.Color(0x333333);
                    });
                });
                this.createLightningEffect();
                break;

            case 'fog':
                this.rain.visible = false;
                this.scene.fog.far = 50;
                break;

            case 'clear':
            default:
                this.rain.visible = false;
                this.scene.fog.far = 300;
                this.clouds.forEach(cloud => {
                    cloud.children.forEach(part => {
                        part.material.color = new THREE.Color(0xffffff);
                    });
                });
                break;
        }
    }

    createLightningEffect() {
        if (Math.random() < 0.02) { // 2% de chance par frame
            const flash = new THREE.DirectionalLight(0xffffff, 2);
            flash.position.set(
                Math.random() * 100 - 50,
                50,
                Math.random() * 100 - 50
            );
            this.scene.add(flash);

            setTimeout(() => {
                this.scene.remove(flash);
            }, 100);

            // Son du tonnerre (à implémenter avec Web Audio API)
            setTimeout(() => {
                // Jouer le son du tonnerre
            }, Math.random() * 2000 + 500);
        }
    }

    updateDayNightCycle(deltaTime) {
        // Avancer le temps
        this.timeOfDay += (24 / this.dayDuration) * deltaTime;
        if (this.timeOfDay >= 24) {
            this.timeOfDay = 0;
        }

        // Calculer l'intensité de la lumière selon l'heure
        let lightIntensity, fogColor, skyColor;

        if (this.timeOfDay >= 6 && this.timeOfDay < 18) {
            // Jour
            const dayProgress = (this.timeOfDay - 6) / 12;
            lightIntensity = 0.4 + Math.sin(dayProgress * Math.PI) * 0.6;
            fogColor = new THREE.Color(0x888888);
            skyColor = new THREE.Color(0x87CEEB);
        } else {
            // Nuit
            lightIntensity = 0.1;
            fogColor = new THREE.Color(0x222222);
            skyColor = new THREE.Color(0x0a0a1a);
        }

        // Lever/Coucher du soleil
        if ((this.timeOfDay >= 5 && this.timeOfDay < 7) ||
            (this.timeOfDay >= 17 && this.timeOfDay < 19)) {
            fogColor = new THREE.Color(0xff6b35);
            skyColor = new THREE.Color(0xff8c42);
        }

        // Appliquer les changements
        if (this.scene.children) {
            const lights = this.scene.children.filter(child => child.isLight);
            lights.forEach(light => {
                if (light.isDirectionalLight) {
                    light.intensity = lightIntensity;
                }
            });
        }

        this.scene.fog.color = fogColor;

        // Mettre à jour le ciel
        const sky = this.scene.children.find(child =>
            child.geometry && child.geometry.type === 'SphereGeometry' && child.material.side === THREE.BackSide
        );
        if (sky) {
            sky.material.color = skyColor;
        }
    }

    update(deltaTime) {
        // Mettre à jour le cycle jour/nuit
        this.updateDayNightCycle(deltaTime);

        // Animation de la pluie
        if (this.rain.visible) {
            const positions = this.rain.geometry.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] -= 0.5;
                if (positions[i] < 0) {
                    positions[i] = 100;
                }
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
        }

        // Mouvement des nuages
        this.clouds.forEach(cloud => {
            cloud.position.x += 0.05;
            if (cloud.position.x > 150) {
                cloud.position.x = -150;
            }
        });

        // Changement météo aléatoire
        if (Math.random() < 0.0001) { // Très rare
            const weathers = ['clear', 'rain', 'storm', 'fog'];
            this.setWeather(weathers[Math.floor(Math.random() * weathers.length)]);
        }
    }
}

// ========================================
// SYSTÈME DE QUÊTES ET OBJECTIFS
// ========================================

class QuestSystem {
    constructor() {
        this.quests = [];
        this.completedQuests = [];
        this.currentQuest = null;

        this.initQuests();
        this.createUI();
    }

    initQuests() {
        this.availableQuests = [
            {
                id: 'zombie_slayer',
                name: 'Tueur de Zombies',
                description: 'Éliminez 50 zombies',
                objective: { type: 'kill', target: 'zombie', count: 50 },
                reward: { coins: 100, xp: 50 },
                progress: 0
            },
            {
                id: 'boss_hunter',
                name: 'Chasseur de Boss',
                description: 'Vainquez 3 boss',
                objective: { type: 'kill', target: 'boss', count: 3 },
                reward: { coins: 500, xp: 200, item: 'legendary_weapon' },
                progress: 0
            },
            {
                id: 'survivor',
                name: 'Survivant',
                description: 'Survivez 10 minutes',
                objective: { type: 'survive', duration: 600 },
                reward: { coins: 200, xp: 100 },
                progress: 0
            },
            {
                id: 'collector',
                name: 'Collectionneur',
                description: 'Ramassez 20 objets',
                objective: { type: 'collect', count: 20 },
                reward: { coins: 150, xp: 75 },
                progress: 0
            },
            {
                id: 'wave_master',
                name: 'Maître des Vagues',
                description: 'Atteignez la vague 10',
                objective: { type: 'wave', target: 10 },
                reward: { coins: 300, xp: 150 },
                progress: 0
            }
        ];

        // Activer la première quête
        this.startQuest(this.availableQuests[0]);
    }

    createUI() {
        const questUI = document.createElement('div');
        questUI.id = 'questUI';
        questUI.style.cssText = `
            position: fixed;
            top: 150px;
            right: 10px;
            width: 250px;
            background: rgba(0,0,0,0.8);
            border: 2px solid #ffd700;
            border-radius: 10px;
            padding: 15px;
            color: white;
            z-index: 100;
        `;
        questUI.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ffd700;">📜 Quête Active</h3>
            <div id="questName" style="font-weight: bold; margin-bottom: 5px;"></div>
            <div id="questDescription" style="font-size: 12px; margin-bottom: 10px;"></div>
            <div id="questProgress" style="background: #333; height: 20px; border-radius: 5px; overflow: hidden;">
                <div id="questProgressBar" style="background: linear-gradient(90deg, #ffd700, #ffed4e); height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="questProgressText" style="text-align: center; margin-top: 5px; font-size: 12px;"></div>
        `;
        document.body.appendChild(questUI);
    }

    startQuest(quest) {
        this.currentQuest = {...quest};
        this.updateUI();
    }

    updateProgress(type, value) {
        if (!this.currentQuest) return;

        if (this.currentQuest.objective.type === type) {
            if (type === 'kill' && value === this.currentQuest.objective.target) {
                this.currentQuest.progress++;
            } else if (type === 'collect') {
                this.currentQuest.progress++;
            } else if (type === 'wave') {
                this.currentQuest.progress = value;
            } else if (type === 'survive') {
                this.currentQuest.progress = value;
            }

            this.updateUI();

            // Vérifier si la quête est complétée
            if (this.isQuestComplete()) {
                this.completeQuest();
            }
        }
    }

    isQuestComplete() {
        const objective = this.currentQuest.objective;

        switch (objective.type) {
            case 'kill':
            case 'collect':
                return this.currentQuest.progress >= objective.count;
            case 'wave':
                return this.currentQuest.progress >= objective.target;
            case 'survive':
                return this.currentQuest.progress >= objective.duration;
            default:
                return false;
        }
    }

    completeQuest() {
        // Animation de complétion
        const questUI = document.getElementById('questUI');
        questUI.style.animation = 'pulse 0.5s 3';

        // Donner les récompenses
        this.giveRewards(this.currentQuest.reward);

        // Ajouter aux quêtes complétées
        this.completedQuests.push(this.currentQuest.id);

        // Notification
        this.showNotification(`Quête Complétée: ${this.currentQuest.name}!`);

        // Passer à la quête suivante
        const nextQuest = this.availableQuests.find(q =>
            !this.completedQuests.includes(q.id) && q.id !== this.currentQuest.id
        );

        if (nextQuest) {
            setTimeout(() => {
                this.startQuest(nextQuest);
            }, 3000);
        } else {
            // Toutes les quêtes sont complétées
            this.showNotification('Toutes les quêtes sont complétées! Félicitations!');
        }
    }

    giveRewards(reward) {
        // Implémenter la distribution des récompenses
        if (reward.coins) {
            window.dispatchEvent(new CustomEvent('addCoins', { detail: { amount: reward.coins } }));
        }
        if (reward.xp) {
            window.dispatchEvent(new CustomEvent('addXP', { detail: { amount: reward.xp } }));
        }
        if (reward.item) {
            window.dispatchEvent(new CustomEvent('addItem', { detail: { item: reward.item } }));
        }
    }

    updateUI() {
        if (!this.currentQuest) return;

        document.getElementById('questName').textContent = this.currentQuest.name;
        document.getElementById('questDescription').textContent = this.currentQuest.description;

        let progressPercent = 0;
        let progressText = '';

        const objective = this.currentQuest.objective;
        switch (objective.type) {
            case 'kill':
            case 'collect':
                progressPercent = (this.currentQuest.progress / objective.count) * 100;
                progressText = `${this.currentQuest.progress} / ${objective.count}`;
                break;
            case 'wave':
                progressPercent = (this.currentQuest.progress / objective.target) * 100;
                progressText = `Vague ${this.currentQuest.progress} / ${objective.target}`;
                break;
            case 'survive':
                progressPercent = (this.currentQuest.progress / objective.duration) * 100;
                const minutes = Math.floor(this.currentQuest.progress / 60);
                const seconds = Math.floor(this.currentQuest.progress % 60);
                progressText = `${minutes}:${seconds.toString().padStart(2, '0')} / ${objective.duration / 60}:00`;
                break;
        }

        document.getElementById('questProgressBar').style.width = progressPercent + '%';
        document.getElementById('questProgressText').textContent = progressText;
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.5s;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// ========================================
// EXPORT DES SYSTÈMES
// ========================================

// Initialisation globale
window.GameEnhancements = {
    BossSystem,
    SkillSystem,
    WeatherSystem,
    QuestSystem,

    // Fonction d'initialisation
    init: function(scene, playerGroup) {
        this.bossSystem = new BossSystem(scene, playerGroup);
        this.skillSystem = new SkillSystem(scene, playerGroup);
        this.weatherSystem = new WeatherSystem(scene);
        this.questSystem = new QuestSystem();

        // Gestionnaire d'événements pour les touches de compétences
        document.addEventListener('keydown', (e) => {
            const key = e.key;

            // Compétences
            if (key === '1') {
                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyQuaternion(playerGroup.quaternion);
                this.skillSystem.castFireball(direction);
            } else if (key === '2') {
                this.skillSystem.castHeal();
            } else if (key === '3') {
                this.skillSystem.castShield();
            } else if (key === '4') {
                // Cibler le zombie le plus proche
                const mousePos = new THREE.Vector3(0, 0, 50);
                this.skillSystem.castLightning(mousePos);
            } else if (key === '5') {
                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyQuaternion(playerGroup.quaternion);
                this.skillSystem.castTeleport(direction);
            }
        });

        // Écouteurs d'événements personnalisés
        window.addEventListener('enemyKilled', (e) => {
            this.questSystem.updateProgress('kill', e.detail.type);
        });

        window.addEventListener('itemCollected', (e) => {
            this.questSystem.updateProgress('collect', 1);
        });

        window.addEventListener('waveCompleted', (e) => {
            this.questSystem.updateProgress('wave', e.detail.wave);
        });

        console.log('🎮 Améliorations du jeu chargées avec succès!');
        console.log('Nouvelles fonctionnalités:');
        console.log('- Système de Boss avec phases');
        console.log('- 4 types de zombies spéciaux');
        console.log('- 5 compétences magiques (touches 1-5)');
        console.log('- Système météo dynamique');
        console.log('- Cycle jour/nuit');
        console.log('- Système de quêtes');
    },

    // Fonction de mise à jour (à appeler dans la boucle d'animation)
    update: function(deltaTime) {
        if (this.skillSystem) this.skillSystem.update(deltaTime);
        if (this.weatherSystem) this.weatherSystem.update(deltaTime);

        // Mise à jour du temps de survie pour les quêtes
        if (this.questSystem && this.questSystem.currentQuest) {
            if (this.questSystem.currentQuest.objective.type === 'survive') {
                this.questSystem.updateProgress('survive',
                    this.questSystem.currentQuest.progress + deltaTime
                );
            }
        }
    }
};

// CSS pour les animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    @keyframes slideIn {
        from { 
            transform: translate(-50%, -50%) translateY(-50px);
            opacity: 0;
        }
        to { 
            transform: translate(-50%, -50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from { 
            transform: translate(-50%, -50%) translateY(0);
            opacity: 1;
        }
        to { 
            transform: translate(-50%, -50%) translateY(50px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('✨ Fichier d\'améliorations chargé! Utilisez GameEnhancements.init(scene, playerGroup) pour initialiser.');